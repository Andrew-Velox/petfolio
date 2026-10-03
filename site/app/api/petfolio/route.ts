/**
 * POST /api/petfolio — the server side of the Petfolio chat.
 *
 * The browser sends { messages } here; this route adds the secret API key
 * (never exposed to the page) and forwards the request to the AI provider.
 * It also decides the model and limits, so the endpoint can't be used as a
 * free general-purpose LLM proxy.
 */
type Role = "system" | "user" | "assistant";
interface Msg {
  role: Role;
  content: string;
}

const PROVIDERS = {
  groq: {
    env: "PETFOLIO_GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "qwen/qwen3.8-27b",
  },
  gemini: {
    env: "PETFOLIO_GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
  },
} as const;

// The widget sends the WHOLE knowledge text (petfolio-cli allows up to 20,000 characters plus a
// 2,000-character personality) in the first, "system" message with every question.
// Providers retire models now and then. Override the default without touching code:
//   PETFOLIO_MODEL=openai/gpt-oss-20b     (list: https://console.groq.com/docs/models)
const MODEL_OVERRIDE = process.env.PETFOLIO_MODEL?.trim();

const MAX_MESSAGES = 12; // system + up to 6 history + question fits comfortably
const MAX_SYSTEM_CHARS = 26_000; // rules + personality + knowledge text
const MAX_CHAT_CHARS = 2_000; // one visitor question or one earlier answer
const MAX_TOTAL_CHARS = 32_000;
const MAX_BODY_BYTES = 150_000; // non-Latin text is up to 3 bytes per character
const RATE_LIMIT = 20; // requests per IP per minute (in-memory: per server instance)

const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return recent.length > RATE_LIMIT;
}

// Other sites allowed to call this route from a browser (e.g. the static copy of the
// site on GitHub Pages): PETFOLIO_ALLOWED_ORIGINS="https://you.github.io,https://example.com"
const ALLOWED_ORIGINS = (process.env.PETFOLIO_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // not a cross-site browser request
  try {
    return new URL(origin).host === req.headers.get("host") || ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...corsHeaders(req) } });
}

/** CORS preflight for the allowed origins above. */
export async function OPTIONS(req: Request) {
  if (!originAllowed(req)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function validMessages(value: unknown): value is Msg[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const [i, m] of value.entries()) {
    if (!m || typeof m !== "object") return false;
    const { role, content } = m as Msg;
    if (typeof content !== "string") return false;
    // exactly one system message, and it comes first; everything after is the conversation
    if (i === 0 ? role !== "system" : role !== "user" && role !== "assistant") return false;
    if (content.length > (i === 0 ? MAX_SYSTEM_CHARS : MAX_CHAT_CHARS)) return false;
    total += content.length;
  }
  return total <= MAX_TOTAL_CHARS;
}

export async function POST(req: Request) {
  // Same-origin or an explicitly allowed origin only (browsers always send Origin on cross-site POSTs).
  if (!originAllowed(req)) return json(req, { error: "forbidden" }, 403);

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json(req, { error: "too large" }, 413);

  const provider = Object.values(PROVIDERS).find((p) => process.env[p.env]);
  if (!provider) return json(req, { error: "chat is not configured" }, 503);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return json(req, { error: "rate limited" }, 429);

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "bad request" }, 400);
  }
  if (!validMessages(body.messages)) return json(req, { error: "bad request" }, 400);

  const model = MODEL_OVERRIDE || provider.model;
  let upstream: Response;
  try {
    upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env[provider.env]}`,
      },
      // model + limits are ours, whatever the browser asked for
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: 0.3,
        max_tokens: 350,
        // gpt-oss models "think" first and the thinking counts against max_tokens: keep it short
        ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return json(req, { error: "upstream unreachable" }, 502);
  }

  // A rejected server key is OUR misconfiguration, not the visitor's: report it as 502
  // (a 401 would make the widget think the visitor's own key was wrong).
  if (!upstream.ok) {
    // The visitor gets a generic message; the real reason goes to the server log (terminal / Vercel logs).
    const detail = (await upstream.text().catch(() => "")).slice(0, 300);
    console.error(`[petfolio] ${model} -> HTTP ${upstream.status}: ${detail}`);
    if (upstream.status === 401 || upstream.status === 403) return json(req, { error: "upstream auth failed" }, 502);
    return json(req, { error: "upstream error" }, upstream.status === 429 ? 429 : 502);
  }

  return json(req, await upstream.json(), 200);
}
