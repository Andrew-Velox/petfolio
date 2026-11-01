<p align="center">
  <img src="https://img.shields.io/badge/PETFOLIO-Premium%20Website%20Companion-101820?style=for-the-badge" alt="Petfolio ? Premium Website Companion" />
</p>

<h1 align="center">Petfolio</h1>
<h3 align="center">A tiny animated friend for your website</h3>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/React_Router-7-CA4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router 7" />
</p>

  ![npm](https://img.shields.io/npm/v/petfolio?color=6366f1&label=npm) ![license](https://img.shields.io/npm/l/petfolio?color=10b981)
---


A tiny animated friend for any website. Petfolio is a Shimeji-style PixiJS companion that walks, runs,
jumps, climbs walls and the ceiling, says cute things, and with a free AI key answers your visitors'
questions about your site.

- One line to add - `Petfolio.summon()`. No config, any framework (or none), TypeScript types included.
- Moves like the original Shimeji - the engine is a port of Shimeji's action and behavior system.
- Never gets in the way - the pet's canvas is click-through; your page's links, buttons, text selection,
  and scrolling keep working. Only the pet's visible pixels catch the mouse.
- Chats about your site - answers only from a text file you write (`npx petfolio-cli about-me.txt`), via your
  own server route so the API key never reaches the browser.

---

## Project Demo

### 1. Landing Page

<p align="center">
  <img src="./Project%20Demo/Landing%20Page.png" alt="Petfolio landing page" width="1200" />
</p>

### 2. Features

<p align="center">
  <img src="./Project%20Demo/Features.png" alt="Petfolio features" width="1200" />
</p>

### 3. Avatars

<p align="center">
  <img src="./Project%20Demo/Avater.png" alt="Petfolio avatar gallery" width="1200" />
</p>

### 4. Custom Avatar

<p align="center">
  <img src="./Project%20Demo/Custom%20Avater,%20Add%20your%20own.png" alt="Custom Petfolio avatar" width="1200" />
</p>

### 5. How it works

<p align="center">
  <img src="./Project%20Demo/How%20it%20works.png" alt="How Petfolio works" width="1200" />
</p>

---

## Quick start

### 1. Install

```bash
npm install petfolio
```

```js
import { Petfolio } from 'petfolio';

const pet = Petfolio.summon();
```

### Script tag (no bundler)

```html
<script src="https://unpkg.com/petfolio"></script>
<script>
  const pet = Petfolio.summon();
</script>
```

> Pin a version in production: `https://unpkg.com/petfolio@3.0.0`.

### React / Next.js

Petfolio uses the browser (`window`, WebGL), so start it inside an effect - never during server rendering.
Importing it inside the effect keeps it out of the server bundle and loads the library lazily:

```tsx
"use client";
import { useEffect } from "react";

export default function PetfolioMount() {
  useEffect(() => {
    let pet: { destroy(): void } | undefined;
    let cancelled = false;

    import("petfolio").then(({ Petfolio }) => {
      if (!cancelled) pet = Petfolio.summon();
    });

    return () => {
      cancelled = true;
      pet?.destroy();
    };
  }, []);

  return null;
}
```

Render `<PetfolioMount />` once, for example in `app/layout.tsx`. The same pattern works in Vue,
Svelte, Nuxt, Astro, and similar frameworks.

### TypeScript

Types ship with the package. `PetfolioOptions`, `PetfolioAiOptions`, and the `Petfolio` class are exported.

---

## Options

```js
Petfolio.summon({
  character: 'saeyoung',
  scale: 0.95,
  autoStart: true,
  idleScale: 1,
  name: 'Mishi',
  ai: { endpoint: '/api/petfolio' },
  suggestions: ['What do you do?', 'Show me your projects'],
  phrases: ['Hi hi!', 'Boop!'],
  chatter: { min: 20, max: 60 },
  ui: true,
  physics: 'page',
  onSettings: () => {},
});
```

| Option | Default | Meaning |
|---|---|---|
| `character` | `'finn'` | Avatar name from the Avatars page. `finn` is built in; others are downloaded. |
| `avatarBase` | jsDelivr | Where avatars are downloaded from. |
| `scale` | `0.95` | Sprite scale. |
| `autoStart` | `true` | Begin auto-pilot immediately. |
| `idleScale` | `1` | Multiplier for longer idle periods. |
| `name` | `'Petfolio'` | Name used in chat and AI prompt. |
| `ai` | - | Chat connection. Without it, the chat asks for a key in dev mode. |
| `suggestions` | 3 generic questions | Starter questions shown in chips. |
| `phrases` | built-in defaults | Lines used during say-hi and random chatter. |
| `chatter` | `{min: 12, max: 30}` | Random speech bubble timing. `false` disables it. |
| `ui` | `true` | Shows menu and chat UI. `false` makes it a plain pet. |
| `physics` | `'floor'` | `'floor'`, `'page'`, or `'corner'` behavior. |
| `onSettings` | - | Callback for the settings button. |

---

## Interaction

- Click or right-click the pet to open the menu: chat, settings, exit.
- Drag it by the head - it dangles, struggles if held too long, and is thrown with your mouse speed.
- Exit sends the pet off-screen; it peeks in from the corner. Click the peeking pet to bring it back.
- While the chat is open, the pet stands still and the chat panel takes the place of its speech bubble.
- The overlay never blocks your page: the canvas covers the viewport but remains pointer-events safe.

---

## Avatars

The package contains one built-in avatar, `finn`, which keeps it small. Every other avatar is downloaded by
name when the pet starts.

1. Open the [Avatars page](https://andrew-velox.github.io/petfolio/avatars/) and copy the name of the one you like.
2. Use it: `Petfolio.summon({ character: 'saeyoung' })`.

```js
Petfolio.summon({ character: 'saeyoung' });
Petfolio.summon({ character: 'saeyoung', avatarBase: '/my-avatars/' });
```

- The sprites live in the repo's `avatars/` folder and are served by jsDelivr by default.
- If the download fails, the pet falls back to `finn` and logs a warning.
- To switch at runtime: `await pet.setCharacter('name')`.

---

## Page physics

By default the pet lives on the edges of the window. With `physics: 'page'` it also uses your page: the top
edge of paragraphs, headings, images, quotes, code blocks, tables, lists, buttons, headers, navs and footers
becomes a ledge. The pet jumps, walks, sits, steps off, and rides the page as it scrolls.

---

## AI chat and knowledge

Petfolio can answer questions from a knowledge file you control. The browser never needs your API key.

### Step 1 - write one text file

Create a plain text or Markdown file such as `about-me.txt`:

```md
# About me
I'm Alex, a full-stack developer in Lisbon. I build web apps with TypeScript and Rust.

## Projects
- Petfolio - a Shimeji-style pet for websites.
- Mocap RS - a motion-capture tool written in Rust.

## Contact
Email alex@example.com. I usually reply within two days.

## Personality
Cheerful and a little shy. Speak in the first person and add a tiny emoji now and then.
```

- Write facts, project history, and contact details in plain sentences.
- Use headings. They become sections the AI can reference.
- Put names, dates, prices, and links exactly as they should be quoted.
- Put private notes inside HTML comments; they are dropped.
- Keep it short, ideally under 8,000 characters.

### Step 2 - turn it into the knowledge file

```bash
npm install -D petfolio-cli
npx petfolio-cli about-me.txt
```

This generates a JSON file such as `public/petfolio-knowledge.json`.

### Step 3 - add a server route that holds the key

Never put an API key in browser code. Keep it in a git-ignored `.env` file:

```bash
PETFOLIO_GROQ_API_KEY=gsk_your_key_here
```

Then add a small route that forwards requests from your site:

```ts
export async function POST(req: Request) {
  const { messages } = await req.json().catch(() => ({}));
  const ok = Array.isArray(messages) && messages.length > 0 && messages.length <= 12 &&
    messages.every((m) => ["system", "user", "assistant"].includes(m?.role) && typeof m?.content === "string" && m.content.length <= 26_000);

  if (!ok) return Response.json({ error: "bad request" }, { status: 400 });

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PETFOLIO_GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: "qwen/qwen3.8-27b", messages, temperature: 0.3, max_tokens: 350 }),
  });

  return Response.json(await r.json(), { status: r.ok ? 200 : 502 });
}
```

### Step 4 - point the widget at it

```js
Petfolio.summon({
  name: 'Mishi',
  ai: {
    endpoint: '/api/petfolio',
    knowledge: '/petfolio-knowledge.json',
  },
});
```

| ai option | Meaning |
|---|---|
| `endpoint` | Your server route. Recommended. |
| `knowledge` | URL of the generated knowledge file or inline data. |
| `apiKey` | Direct mode for local testing only. |

---

## Why developers use it

- It is tiny, lightweight, and easy to drop into an existing site.
- It respects your layout and never blocks clicks or scrolling.
- It is fully type-safe in TypeScript.
- It is easy to self-host and easy to keep private.

---

## License

Petfolio is released under the MIT license. See [LICENSE](LICENSE) for details.

---

## Repository

- GitHub: [petfolio](https://github.com/Andrew-Velox/petfolio)
- Docs: [site](./site)
- Avatars: [avatars](./avatars)
