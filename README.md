# 🐾 Petfolio

A tiny animated friend for any website. Petfolio is a Shimeji-style PixiJS companion that walks, runs,
jumps, climbs walls and the ceiling, says cute things — and, with a free AI key, **answers your visitors'
questions about your site**.

![npm](https://img.shields.io/npm/v/petfolio?color=6366f1&label=npm) ![license](https://img.shields.io/npm/l/petfolio?color=10b981)

- **One line to add** — `Petfolio.summon()`. No config, any framework (or none), TypeScript types included.
- **Moves like the original Shimeji** — the engine is a port of Shimeji's action/behaviour system.
- **Never gets in the way** — the pet's canvas is click-through; your page's links, buttons, text selection
  and scrolling keep working. Only the pet's visible pixels catch the mouse.
- **Chats about your site** — answers only from a text file *you* write (`npx petfolio-cli about-me.txt`), via your own server
  route so the API key never reaches the browser.

---

## Quick start

### 1. Install

```bash
npm install petfolio
```

```js
import { Petfolio } from 'petfolio';

const pet = Petfolio.summon();   // fullscreen click-through overlay + the pet, auto-pilot on
```

### Script tag (no bundler)

```html
<script src="https://unpkg.com/petfolio"></script>
<script>
  const pet = Petfolio.summon();   // `Petfolio` is a global
</script>
```

> Pin a version in production: `https://unpkg.com/petfolio@2.0.0`.

### React / Next.js

Petfolio uses the browser (`window`, WebGL), so start it inside an effect — never during server rendering.
Importing it inside the effect keeps it out of the server bundle and loads the ~1.9 MB (≈1 MB gzipped) library
lazily:

```tsx
"use client";
import { useEffect } from "react";

export default function PetfolioMount() {
  useEffect(() => {
    let pet: { destroy(): void } | undefined;
    let cancelled = false;
    import("petfolio").then(({ Petfolio }) => {
      if (!cancelled) pet = Petfolio.summon();   // `cancelled` covers React StrictMode's dev remount
    });
    return () => { cancelled = true; pet?.destroy(); };
  }, []);
  return null;
}
```

Render `<PetfolioMount />` once, e.g. in `app/layout.tsx`. The same pattern works in Vue (`onMounted` /
`onUnmounted`), Svelte (`onMount`), Nuxt (`<ClientOnly>` or `onMounted`), Astro (`client:only`) and so on.

### TypeScript

Types ship with the package (`types/index.d.ts`) — `PetfolioOptions`, `PetfolioAiOptions` and the `Petfolio`
class are exported.

---

## Options

```js
Petfolio.summon({
  character: 'finn',          // 'an2' | 'finn' — see Petfolio.availableCharacters()
  scale: 0.95,                // sprite scale
  autoStart: true,            // start auto-pilot immediately (false = manual control)
  idleScale: 1,               // < 1 shortens Shimeji's long stand/sit periods (0.3 = livelier)
  name: 'Mishi',              // persona name in the chat
  ai: { endpoint: '/api/petfolio' },        // chat — see "AI chat"
  suggestions: ['What do you do?', 'Show me your projects'],   // chat starter chips ([] = none)
  phrases: ['Hi hi! 💕', 'Boop!'],          // your own cute lines
  chatter: { min: 20, max: 60 },            // seconds between random speech bubbles (false = off)
  ui: true,                   // click / right-click menu + chat (false = just the pet)
  onSettings: () => {},       // called by the menu's Settings button (does nothing by default)
});
```

| Option | Default | Meaning |
|---|---|---|
| `character` | first one | Avatar to start with. Visitors can switch from the menu. |
| `scale` | `0.95` | Sprite size multiplier. |
| `autoStart` | `true` | Begin the random-behaviour auto-pilot. |
| `idleScale` | `1` | Multiplier for the long idle periods (1 = original Shimeji). |
| `name` | `'Petfolio'` | Name shown in the chat and used in the AI prompt. |
| `ai` | — | Chat connection (see below). Without it the chat asks for a key (dev only). |
| `chat` | `true` | `false` hides the chat button (a plain pet with a menu, no AI). |
| `suggestions` | 3 generic questions | Starter questions shown as chips. `[]` = none. |
| `phrases` | ~30 built in | Lines for the say-hi animation and random chatter. |
| `chatter` | `{min: 12, max: 30}` | Random speech bubbles. `false` = only the say-hi animation speaks. |
| `ui` | `true` | The menu and chat panel. `false` = a plain pet, no UI. |
| `onSettings` | — | Callback for the menu's Settings button. |

---

## Interaction

- **Click or right-click** the pet to open the menu: **avatar** switch · **chat** · **settings** · **exit**.
  (A tap works on touch screens, which have no right-click.)
- **Drag** it by the head — it dangles, struggles if held too long, and is **thrown** with your mouse speed.
- **Exit** sends the pet off screen; it peeks in from the corner. **Click the peeking pet** to bring it back.
- While the **chat** is open the pet stands still on its say-hi frame and the chat box takes the place of its
  speech bubble. From a wall or the ceiling it drops to the floor first; from the corner it walks back in.
  Close with × or `Esc`.

The overlay never blocks your page: the canvas covers the viewport but is `pointer-events: none` except
while the pointer is over the pet's visible pixels.

## API

```js
const pet = Petfolio.summon();

pet.startAuto();            // random behaviour (Shimeji's weighted auto-pilot)
pet.stopAuto();             // stop and idle
pet.toggleAuto();           // → boolean, whether auto-pilot is now on
pet.isAuto;                 // boolean

pet.changeState('sit');     // play a behaviour now (see names below)
pet.triggerState('say_hi'); // …then auto-pilot resumes after ~3 s
pet.chaseMouse();           // follow the pointer
pet.exitToPeek();           // walk off screen and peek in (click it / startAuto() to return)

pet.setCharacter('finn');
Petfolio.availableCharacters();   // ['an2', 'finn']

pet.startChat();            // what the menu's chat button does
pet.endChat();

pet.destroy();              // remove the pet, its canvas and its menu
```

### Behaviour names

`changeState()` accepts the short names `idle`, `sit`, `say_hi`, `tv_clone`, `remove_cap`, `summon`
(fall-from-the-sky entrance), `walk-off-left`, `walk-off-right` — or **any Shimeji behaviour name**:
`StandUp`, `SitDown`, `LieDown`, `WalkAlongWorkAreaFloor`, `RunAlongWorkAreaFloor`,
`CrawlAlongWorkAreaFloor`, `ClimbAlongWall`, `ClimbHalfwayAlongWall`, `ClimbAlongCeiling`,
`JumpFromLeftWall`, `JumpFromRightWall`, `GrabWorkAreaBottomLeftWall`, `ChaseMouse`, `SayHi`, `TvClone`,
`RemoveCap`, … (an unknown name logs a warning and idles). The full list is in
`packages/petfolio/src/engine/shime-config.js`.

### Cute messages

The say-hi animation shows a random short message, and the pet also says something cute by itself every
12–30 seconds, whatever it is doing. The bubble stays up ~3.5 s and rides along with the pet; it stays quiet
while the pet is held, while the chat is open and while it is off screen. Use `phrases` and `chatter` (above)
to change the lines and the timing.

---

## AI chat

Visitors open the chat from the menu and ask about you or your site. The pet answers **only from a text file you
write** and says "I don't know" otherwise. There is no database, no embeddings and nothing to host: the text is
read once, kept in the browser's memory, and sent along with every question ("context stuffing").

```
 about-me.txt ──npx petfolio-cli──▶ public/petfolio-knowledge.json
                                        │  fetched once when the page loads
 visitor's question + the whole text ───┴──▶ your server route ──adds the secret key──▶ Groq / Gemini
        ▲                                     (/api/petfolio)                                │
        └──────────────────────────────────────── answer ◀───────────────────────────────────┘
```

### Step 1 — write one text file

Anywhere in your project — `about-me.txt`, `content/about.md`, whatever you like. Plain text or Markdown:

```md
# About me
I'm Alex, a full-stack developer in Lisbon. I build web apps with TypeScript and Rust.

## Projects
- Petfolio — a Shimeji-style pet for websites.
- Mocap RS — a motion-capture tool written in Rust.

## Contact
Email alex@example.com. I usually reply within two days.

## Personality
Cheerful and a little shy. Speak in the first person and add a tiny emoji now and then.
```

- **Facts:** background, resume, projects, FAQ, how to contact you — whatever visitors ask about. Write full
  sentences; the model reads it like a person would.
- **Use headings.** Each heading becomes a titled section, and the AI uses the titles to find the right topic
  (`Contact` for "how do I reach you?"). Nested headings become `Projects > Petfolio`. Text before the first
  heading is the `About` section. Name headings after what visitors ask about.
- **Say it once, plainly.** Put names, dates, prices and links in the text exactly as they should be quoted.
  The pet is told to copy them verbatim and to say "I don't know" rather than guess.
- **Private notes:** `<!-- anything in an HTML comment -->` is dropped and never reaches the output.
- **Personality (optional):** put the pet's voice under a heading named `Personality` (or `Persona`), at any
  heading level. It runs until the next heading of the same or a higher level. It shapes the *tone*; it can't
  override the rule "answer only from the facts".
- **Keep it short.** All of it is sent with every question. Aim for under ~8,000 characters (about 2,000
  tokens); the CLI refuses more than 20,000. Free AI tiers limit tokens per minute, so shorter text means
  more questions per minute.
- **It is public.** The knowledge file is served from your site, so anyone can read it. Write only what you
  are happy to publish — never passwords or keys (the CLI warns if the text looks like a key).

### Step 2 — turn it into the knowledge file

```bash
npm install -D petfolio-cli
npx petfolio-cli about-me.txt                    # → public/petfolio-knowledge.json
npx petfolio-cli about-me.txt --out static       # elsewhere (SvelteKit: static, Angular: src/assets, …)
```

```
petfolio-cli: about-me.txt -> public/petfolio-knowledge.json
  facts        1,204 characters (about 301 tokens per question)
  sections     4: About me | Projects | Contact | …
  personality  96 characters
```

The result is a small, readable JSON file — one titled section per heading, with Markdown clutter (`**bold**`,
backticks, `[links](…)` → `links (…)`, images, rules) cleaned out so the model reads plain sentences. Same
input gives the same bytes, so it diffs cleanly in git:

```json
{
  "version": 2,
  "sections": [
    { "title": "About me", "text": "I'm Alex, a full-stack developer in Lisbon. …" },
    { "title": "Projects", "text": "- Petfolio — a Shimeji-style pet for websites.\n- Mocap RS — …" },
    { "title": "Contact", "text": "Email alex@example.com. I usually reply within two days." }
  ],
  "personality": "Cheerful and a little shy. …"
}
```

Check the `sections` line the CLI prints: if a section you expected is missing or merged into another, fix
your headings. The widget sends the pet's rules, the list of topics, the personality and all sections with each
question.

Run it again whenever you edit the text. To do that automatically on every build (so deployments on Vercel,
Netlify, GitHub Actions … stay current), or just commit the generated file:

```json
{ "scripts": { "kb": "petfolio-cli about-me.txt", "prebuild": "npm run kb", "predev": "npm run kb" } }
```

The CLI has no dependencies and never touches your other files. It exits with an error (and writes nothing) for
a missing, empty, binary (`.pdf`, `.docx` …) or too-long file.

### Step 3 — add a server route that holds the key

**Never put an API key in browser code** — anyone can read it. Get a free key (Groq: <https://console.groq.com/keys>,
Gemini: <https://aistudio.google.com/apikey>), put it in a git-ignored `.env`:

```bash
PETFOLIO_GROQ_API_KEY=gsk_your_key_here        # or PETFOLIO_GEMINI_API_KEY=…
```

and add a small route that adds it to the request and forwards it. Make the route choose the model and limits,
so it can't be used as a free general-purpose LLM proxy.

**Next.js (App Router)** — `app/api/petfolio/route.ts` (a complete version with validation, a same-origin
check, size limits and rate limiting lives in [`site/app/api/petfolio/route.ts`](site/app/api/petfolio/route.ts)):

```ts
export async function POST(req: Request) {
  const { messages } = await req.json().catch(() => ({}));
  const ok = Array.isArray(messages) && messages.length > 0 && messages.length <= 12 &&
    messages.every((m) => ["system", "user", "assistant"].includes(m?.role) && typeof m?.content === "string" && m.content.length <= 26_000);
  if (!ok) return Response.json({ error: "bad request" }, { status: 400 });

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PETFOLIO_GROQ_API_KEY}` },
    body: JSON.stringify({ model: "qwen/qwen3.8-27b", messages, temperature: 0.3, max_tokens: 350 }),
  });
  return Response.json(await r.json(), { status: r.ok ? 200 : 502 });
}
```

**Express / any Node server**

```js
app.post('/api/petfolio', express.json({ limit: '150kb' }), async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return res.status(400).end();
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PETFOLIO_GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'qwen/qwen3.8-27b', messages, temperature: 0.3, max_tokens: 350 }),
  });
  res.status(r.ok ? 200 : 502).json(await r.json());
});
```

**Gemini?** Use `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, model
`gemini-2.0-flash`, and `PETFOLIO_GEMINI_API_KEY`. The browser sends a default model name, but your route
decides the model — it is the one place to change it.

**Models get retired.** Providers rename and remove free models from time to time (`llama-3.1-8b-instant` on Groq
is gone). When chat suddenly fails with a 502, the route's server log says `model_not_found` — pick a current
model from <https://console.groq.com/docs/models>. The `site/` route reads it from an environment variable, so
it is a settings change, not a code change: `PETFOLIO_MODEL=openai/gpt-oss-20b`.

The route must answer with the provider's normal JSON (`{ "choices": [{ "message": { "content": "…" } }] }`).

Because the browser sends the text, the route can't check that it is *your* text — so treat it as a small public
service and keep it cheap to abuse: fix the model and `max_tokens` in the route, cap the message sizes (the
`site/` route allows one system message up to 26,000 characters and visitor/assistant messages up to 2,000), check
the `Origin`, and rate-limit per IP (the example limits in memory — use a shared store such as Redis/Upstash on
serverless platforms).

### Step 4 — point the widget at it

```js
Petfolio.summon({
  name: 'Mishi',
  ai: {
    endpoint: '/api/petfolio',                  // your route (key stays on the server)
    knowledge: '/petfolio-knowledge.json',      // default; change it if you used --out
  },
});
```

| `ai` option | Meaning |
|---|---|
| `endpoint` | Your server route. **Recommended.** |
| `knowledge` | URL of the file the CLI wrote (default `/petfolio-knowledge.json`), or the data itself: `{ sections, personality }`, `{ content, personality }` or a plain string. |
| `apiKey` | Direct mode — **local testing only**: the key is visible to anyone using the page. |
| `provider` / `model` | `'groq'` (default) or `'gemini'`; override the model name (direct mode). |

**Quick local test without a route:** omit `endpoint`, open the chat and paste a key (or pass `ai: { apiKey }`).
It is kept in that browser's `localStorage`. Never ship this.

### Upgrading from 1.x

1. `npm i petfolio@2` and `npm i -D petfolio-cli@2`.
2. Write your text file (Step 1) and run `npx petfolio-cli about-me.txt`. Delete the old
   `public/petfolio-knowledgeBase.json`, and change any `petfolio-cli --scan-only` script to
   `petfolio-cli about-me.txt`.
3. The CLI no longer asks for or saves your API key — keep it in `.env` yourself (Step 3).
4. **Update your server route's size limits.** The browser now sends the whole text, up to about 25,000
   characters per request. A route that rejects bodies over a few KB (for example `express.json({ limit: '50kb' })`
   or a 12,000-character cap) will answer 400 — use the limits from Step 3 / `site/app/api/petfolio/route.ts`.

### Troubleshooting the chat

| Symptom | Likely cause |
|---|---|
| "The AI service returned an error (502)" | Your route got a rejected key or a provider error — **look at the terminal running the server**: the route logs the provider's real reason (`[petfolio] <model> -> HTTP 404: model_not_found` = retired model, set `PETFOLIO_MODEL`; HTTP 401 = bad key). Also check that `.env` has a valid `PETFOLIO_GROQ_API_KEY`, and restart the server after editing it. |
| "Too many questions right now" | The provider's or your route's rate limit (429). If it happens after only a few questions, your text is long: it is re-sent with every question and uses up the free tier's tokens per minute — shorten it. |
| "I don't know" for things you wrote | The file isn't being found (check the browser's Network tab for `/petfolio-knowledge.json`; the console says `[petfolio] Could not load the knowledge file …`), it is stale (re-run `npx petfolio-cli about-me.txt`), or the answer isn't written in it in plain sentences. |
| Chat asks for an API key | `ai.endpoint` isn't set (the widget is in direct mode). |
| Answers ignore new content | Re-run the CLI and redeploy — the browser re-checks the file on every page load, so a hard refresh isn't needed. |
| 400 from your route | The text exceeds your route's size limits (26,000 characters for the first message in `site/`). |

---

## Good to know

- **Size:** ~1.9 MB (≈1 MB gzipped), because PixiJS and the sprites for both characters are inlined — nothing
  else to host. Load it lazily (see the React example) so it doesn't block your page.
- **Content-Security-Policy:** works with a strict CSP — no `unsafe-eval` and no `unsafe-inline` styles
  needed. You do need `img-src data:` (sprites are data URLs) and, for the chat, a `connect-src` that includes
  your route (`'self'` covers a same-origin route).
- **Touch:** tap the pet for the menu. Dragging by touch is best-effort (the browser may scroll instead);
  mouse and pen are the primary targets.
- **Multiple instances:** `summon()` reuses the `#petfolio-canvas` element. Call `pet.destroy()` before
  summoning again.
- **Page scrollbars:** the pet's right wall is the visible edge of the page, not the edge behind the scrollbar.

---

## Animation engine (Shimeji port)

Movement is driven by `packages/petfolio/src/engine/`, a port of the original Shimeji engine: 25 ticks/second,
`Pose` (sprite + per-tick velocity + duration) → `Animation` → `Action` (Stay / Move / Jump / Fall / Dragged /
Sequence / Select) → `Behavior`. Auto-pilot is Shimeji's own weighted-random "next behaviour" picker with
floor/wall/ceiling conditions; the numbers live in `engine/shime-config.js` (a port of `actions.xml` +
`behaviors.xml`). The engine has no Pixi/DOM dependency, so it is tested headlessly.

## Development

```bash
cd packages/petfolio
npm run dev              # sandbox with hot reload
npm run build:lib        # dist/petfolio.mjs + .cjs + .global.js
npm run inline-sprites   # regenerate the inlined sprite bundle (run after changing public/characters)
node --test test/        # engine + AI tests (headless)
cd ../petfolio-cli && npm test   # text file -> knowledge JSON, incl. the real binary
```

The sandbox chat reads `public/petfolio-knowledge.json` (git-ignored): make one with
`npx petfolio-cli ../../site/content/about.txt` from `packages/petfolio`.

Adding an avatar: drop a folder of `shime1.png … shime46.png` (plus an optional `character.json` with a
`displayName`) into `packages/petfolio/public/characters/<name>/` and run `npm run inline-sprites`.

Publishing (both packages): bump the versions, `npm login`, then `npm publish` in `packages/petfolio` and
`packages/petfolio-cli` (`prepublishOnly` rebuilds and copies this README + the LICENSE into the package).

## Deploying the demo site (`site/`)

The landing page in [`site/`](site) deploys to **GitHub Pages** with the workflow in
[`.github/workflows/pages.yml`](.github/workflows/pages.yml):

1. Publish `petfolio` and `petfolio-cli` to npm first (the site installs them from npm).
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site goes live at `https://<user>.github.io/<repo>/`.

Pages only serves static files, so the build is a static export and the `/api/petfolio` route is **left out**.
Without a chat server the pet still works, just without the chat button. A secret key can't live in a static
page, so the chat needs a small server somewhere. Pick one, then add the GitHub Actions **variable**
`PETFOLIO_ENDPOINT` (Settings → Secrets and variables → Actions → *Variables*) with its address and re-run the
Pages workflow:

- **Vercel (or any Node host)** — deploy `site/` (Root Directory `site`) with `PETFOLIO_GROQ_API_KEY` and
  `PETFOLIO_ALLOWED_ORIGINS=https://<user>.github.io` (origin only: no path, no trailing slash).
  `PETFOLIO_ENDPOINT` = `https://<project>.vercel.app/api/petfolio`.

Custom domain, or a `<user>.github.io` repo (site at the root)? Add the Actions variable `BASE_PATH` = `/`.

## Project structure

```
packages/
├── petfolio/            ← the library (npm: petfolio)
│   ├── src/
│   │   ├── index.js         NPM entry (Petfolio.summon()); global.js = <script> entry
│   │   ├── Petfolio.js      Pixi renderer + public API (25 fps fixed-step loop)
│   │   ├── interaction.js   pointer → engine (click-through canvas, drag / throw / tap)
│   │   ├── bubble.js, phrases.js, constants.js, textures.js
│   │   ├── ai/              knowledge loader + chat client (no DOM)
│   │   ├── ui/              icon menu, avatar picker, chat panel
│   │   └── engine/          Shimeji engine port (no Pixi/DOM)
│   ├── types/index.d.ts
│   └── test/
└── petfolio-cli/        ← about-me.txt → public/petfolio-knowledge.json (npm: petfolio-cli)
site/                    ← the Petfolio website (Next.js) — also a working example of everything above
```

## License

MIT
