# 🐾 Petfolio

A tiny animated friend for any website. Petfolio is a Shimeji-style PixiJS companion that walks, runs,
jumps, climbs walls and the ceiling, says cute things — and, with a free AI key, **answers your visitors'
questions about your site**.

![npm](https://img.shields.io/npm/v/petfolio?color=6366f1&label=npm) ![license](https://img.shields.io/npm/l/petfolio?color=10b981)

- **One line to add** — `Petfolio.summon()`. No config, any framework (or none), TypeScript types included.
- **Moves like the original Shimeji** — the engine is a port of Shimeji's action/behaviour system.
- **Never gets in the way** — the pet's canvas is click-through; your page's links, buttons, text selection
  and scrolling keep working. Only the pet's visible pixels catch the mouse.
- **Chats about your site** — answers only from *your* content (built by `petfolio-cli`), via your own server
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

> Pin a version in production: `https://unpkg.com/petfolio@1.2.0`.

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

Visitors open the chat from the menu and ask about your site. The pet answers **only from your own content**
and says "I don't know" otherwise. For each question the browser picks the few most relevant snippets of your
knowledge base (keyword/TF·IDF search, no embeddings), sends them with the last few messages to the model, and
shows the answer. Free tiers (Groq `llama-3.1-8b-instant` by default; Gemini also works) are plenty.

```
 browser ──question──▶ your server route (/api/petfolio) ──adds secret key──▶ Groq / Gemini
    ▲  knowledge base (public JSON, searched in the browser)                         │
    └─────────────────────────────────── answer ◀────────────────────────────────────┘
```

### Step 1 — build the knowledge base

```bash
npm install -D petfolio-cli
npx petfolio-cli
```

It asks for a provider and API key (saved to `.env` — **make sure `.env` is in your `.gitignore`**; the CLI
warns you if it isn't) and scans your project for human-readable text, writing
`public/petfolio-knowledgeBase.json`.

What it reads: string literals and JSX text in `.js/.jsx/.ts/.tsx`, plus **`.md`, `.mdx` and `.txt` files**.
It skips `node_modules`, build output, tests, config files, `api/` routes and the root `README.md`.

> **Teach the pet with prose.** Code gives it little to work with. The best knowledge base is a Markdown file
> about your site — who you are, what you do, projects, how to contact you, FAQs. Put it anywhere (e.g.
> `content/about.md`) and re-run the CLI.

Options (non-interactive, for CI and `package.json` scripts):

```bash
npx petfolio-cli --scan-only          # regenerate the knowledge base only: no prompts, .env untouched
npx petfolio-cli --out static         # write elsewhere (SvelteKit: static, Angular: src/assets, …)
```

Keep it fresh automatically:

```json
{ "scripts": { "kb": "petfolio-cli --scan-only", "prebuild": "npm run kb" } }
```

> The file is generated, so `**/public/petfolio-knowledgeBase.json` is git-ignored in this repo. Regenerating
> it in `prebuild` is what makes deployments (Vercel, Netlify, …) work.

### Step 2 — add a server route that holds the key

**Never put an API key in browser code** — anyone can read it. Add a small route that adds the key (the
`PETFOLIO_GROQ_API_KEY` / `PETFOLIO_GEMINI_API_KEY` the CLI wrote to `.env`) and forwards the request. Make the
route choose the model and limits, so it can't be used as a free general-purpose LLM proxy.

**Next.js (App Router)** — `app/api/petfolio/route.ts` (a complete version with validation, a same-origin
check and rate limiting lives in [`site/app/api/petfolio/route.ts`](site/app/api/petfolio/route.ts)):

```ts
export async function POST(req: Request) {
  const { messages } = await req.json().catch(() => ({}));
  const ok = Array.isArray(messages) && messages.length > 0 && messages.length <= 12 &&
    messages.every((m) => ["system", "user", "assistant"].includes(m?.role) && typeof m?.content === "string");
  if (!ok) return Response.json({ error: "bad request" }, { status: 400 });

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PETFOLIO_GROQ_API_KEY}` },
    body: JSON.stringify({ model: "llama-3.1-8b-instant", messages, temperature: 0.3, max_tokens: 350 }),
  });
  return Response.json(await r.json(), { status: r.ok ? 200 : 502 });
}
```

**Express / any Node server**

```js
app.post('/api/petfolio', express.json({ limit: '50kb' }), async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return res.status(400).end();
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PETFOLIO_GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, temperature: 0.3, max_tokens: 350 }),
  });
  res.status(r.ok ? 200 : 502).json(await r.json());
});
```

**Gemini?** Use `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, model
`gemini-2.0-flash`, and `PETFOLIO_GEMINI_API_KEY`. The browser sends a default model name, but your route
decides the model — it is the one place to change it.

The route must answer with the provider's normal JSON (`{ "choices": [{ "message": { "content": "…" } }] }`).
Add rate limiting if the site is public (the example in `site/` limits per IP in memory — use a shared store
such as Redis/Upstash on serverless platforms).

### Step 3 — point the widget at it

```js
Petfolio.summon({
  name: 'Mishi',
  ai: {
    endpoint: '/api/petfolio',                  // your route (key stays on the server)
    knowledge: '/petfolio-knowledgeBase.json',  // default; change if you used --out
  },
});
```

| `ai` option | Meaning |
|---|---|
| `endpoint` | Your server route. **Recommended.** |
| `knowledge` | URL of the knowledge base JSON (or the data itself). Default `/petfolio-knowledgeBase.json`. |
| `apiKey` | Direct mode — **local testing only**: the key is visible to anyone using the page. |
| `provider` / `model` | `'groq'` (default) or `'gemini'`; override the model name (direct mode). |

**Quick local test without a route:** omit `endpoint`, open the chat and paste a key (or pass `ai: { apiKey }`).
It is kept in that browser's `localStorage`. Never ship this.

### Troubleshooting the chat

| Symptom | Likely cause |
|---|---|
| "The AI service returned an error (502)" | Your route got a rejected key or a provider error. Check `.env` has a valid `PETFOLIO_GROQ_API_KEY` (re-run `npx petfolio-cli`) and restart the server. |
| "Too many questions right now" | The provider's or your route's rate limit (429). |
| "I don't know" for things you wrote | The knowledge base is stale or thin. Re-run `npx petfolio-cli --scan-only`, add an `about.md`. |
| Chat asks for an API key | `ai.endpoint` isn't set (the widget is in direct mode). |
| Answers ignore new content | The browser cached the knowledge base — hard refresh, or regenerate it in `prebuild`. |

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
```

Adding an avatar: drop a folder of `shime1.png … shime46.png` (plus an optional `character.json` with a
`displayName`) into `packages/petfolio/public/characters/<name>/` and run `npm run inline-sprites`.

Publishing (both packages): bump the versions, `npm login`, then `npm publish` in `packages/petfolio` and
`packages/petfolio-cli` (`prepublishOnly` rebuilds and copies this README + the LICENSE into the package).

## Deploying the demo site (`site/`)

The landing page in [`site/`](site) deploys to **GitHub Pages** with the workflow in
[`.github/workflows/pages.yml`](.github/workflows/pages.yml):

1. Publish `petfolio` and `petfolio-cli` to npm first (the site installs them from npm), run `npm install` in
   `site/` and commit the updated `package-lock.json`.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site goes live at `https://<user>.github.io/<repo>/`.

Pages only serves static files, so the build is a static export and the `/api/petfolio` route is **left out**.
By default the pet runs without the chat button. To keep the chat on Pages, deploy the site to a host that runs
server code (e.g. Vercel, with `PETFOLIO_GROQ_API_KEY` set), then:

- on that server, set `PETFOLIO_ALLOWED_ORIGINS=https://<user>.github.io` (it accepts same-origin requests only otherwise);
- in the GitHub repo (Settings → Secrets and variables → Actions → **Variables**), add
  `PETFOLIO_ENDPOINT=https://<your-server>/api/petfolio`.

Custom domain or a `<user>.github.io` repo (site at the root)? Add the Actions variable `BASE_PATH` = `/`.

## Project structure

```
packages/
├── petfolio/            ← the library (npm: petfolio)
│   ├── src/
│   │   ├── index.js         NPM entry (Petfolio.summon()); global.js = <script> entry
│   │   ├── Petfolio.js      Pixi renderer + public API (25 fps fixed-step loop)
│   │   ├── interaction.js   pointer → engine (click-through canvas, drag / throw / tap)
│   │   ├── bubble.js, phrases.js, constants.js, textures.js
│   │   ├── ai/              knowledge search + chat client (no DOM)
│   │   ├── ui/              icon menu, avatar picker, chat panel
│   │   └── engine/          Shimeji engine port (no Pixi/DOM)
│   ├── types/index.d.ts
│   └── test/
└── petfolio-cli/        ← knowledge-base generator (npm: petfolio-cli)
site/                    ← the Petfolio website (Next.js) — also a working example of everything above
```

## License

MIT
