/**
 * Petfolio chat server for Cloudflare Workers — the secret-holding half of the chat.
 *
 * The browser (your GitHub Pages site) sends { messages } here; the Worker adds the secret
 * API key (never exposed to the page) and forwards the request to Groq / Gemini. It also
 * decides the model and limits, so it can't be used as a free general-purpose LLM proxy.
 *
 * Same behaviour as site/app/api/petfolio/route.ts (the Next.js version for Vercel / any Node
 * host) — keep the two in sync. Configuration (see wrangler.toml and README.md):
 *   secret  PETFOLIO_GROQ_API_KEY  or  PETFOLIO_GEMINI_API_KEY
 *   var     PETFOLIO_ALLOWED_ORIGINS   "https://you.github.io,https://example.com"
 *   var     PETFOLIO_MODEL             optional model override (providers retire models)
 */

const PROVIDERS = [
  {
    env: 'PETFOLIO_GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'qwen/qwen3.8-27b',
  },
  {
    env: 'PETFOLIO_GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
  },
];

// The widget sends the WHOLE knowledge text (petfolio-cli allows up to 20,000 characters plus a
// 2,000-character personality) in the first, "system" message with every question.
const MAX_MESSAGES = 12;          // system + up to 6 history + question fits comfortably
const MAX_SYSTEM_CHARS = 26_000;  // rules + personality + knowledge text
const MAX_CHAT_CHARS = 2_000;     // one visitor question or one earlier answer
const MAX_TOTAL_CHARS = 32_000;
const MAX_BODY_BYTES = 150_000;   // non-Latin text is up to 3 bytes per character
const RATE_LIMIT = 20;            // requests per IP per minute — in memory, so per Worker instance

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return recent.length > RATE_LIMIT;
}

const allowedOrigins = (env) =>
  String(env.PETFOLIO_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

/** No Origin header = not a cross-site browser request (curl, server-to-server): allowed. */
function originAllowed(request, env) {
  const origin = request.headers.get('origin');
  return !origin || allowedOrigins(env).includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (request, env, body, status) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...corsHeaders(request, env) } });

function validMessages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const [i, m] of value.entries()) {
    if (!m || typeof m !== 'object') return false;
    const { role, content } = m;
    if (typeof content !== 'string') return false;
    // exactly one system message, and it comes first; everything after is the conversation
    if (i === 0 ? role !== 'system' : role !== 'user' && role !== 'assistant') return false;
    if (content.length > (i === 0 ? MAX_SYSTEM_CHARS : MAX_CHAT_CHARS)) return false;
    total += content.length;
  }
  return total <= MAX_TOTAL_CHARS;
}

async function chat(request, env) {
  if (!originAllowed(request, env)) return json(request, env, { error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json(request, env, { error: 'too large' }, 413);

  const provider = PROVIDERS.find((p) => env[p.env]);
  if (!provider) return json(request, env, { error: 'chat is not configured' }, 503);

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (rateLimited(ip)) return json(request, env, { error: 'rate limited' }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json(request, env, { error: 'bad request' }, 400);
  }
  if (!validMessages(body?.messages)) return json(request, env, { error: 'bad request' }, 400);

  const model = String(env.PETFOLIO_MODEL ?? '').trim() || provider.model;
  let upstream;
  try {
    upstream = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env[provider.env]}` },
      // model + limits are ours, whatever the browser asked for
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: 0.3,
        max_tokens: 350,
        // gpt-oss models "think" first and the thinking counts against max_tokens: keep it short
        ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return json(request, env, { error: 'upstream unreachable' }, 502);
  }

  if (!upstream.ok) {
    // The visitor gets a generic message; the real reason goes to the Worker log (`npx wrangler tail`).
    const detail = (await upstream.text().catch(() => '')).slice(0, 300);
    console.error(`[petfolio] ${model} -> HTTP ${upstream.status}: ${detail}`);
    // A rejected server key is OUR misconfiguration, not the visitor's: report it as 502
    // (a 401 would make the widget think the visitor's own key was wrong).
    if (upstream.status === 401 || upstream.status === 403) return json(request, env, { error: 'upstream auth failed' }, 502);
    return json(request, env, { error: 'upstream error' }, upstream.status === 429 ? 429 : 502);
  }
  return json(request, env, await upstream.json(), 200);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return originAllowed(request, env)
        ? new Response(null, { status: 204, headers: corsHeaders(request, env) })
        : new Response(null, { status: 403 });
    }
    if (request.method === 'POST') return chat(request, env);
    if (request.method === 'GET') {
      // open this URL in a browser to check the deployment (reveals nothing secret)
      return json(request, env, { ok: true, service: 'petfolio-chat', configured: PROVIDERS.some((p) => env[p.env]) }, 200);
    }
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST, OPTIONS' } });
  },
};
