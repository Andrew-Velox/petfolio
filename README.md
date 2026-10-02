# 🐾 Petfolio

Drop-in animated desktop pet for any website. A Shimeji-style PixiJS companion that walks, crawls, jumps, and responds to dragging — all with zero configuration.

![Petfolio](https://img.shields.io/npm/v/petfolio?color=6366f1&label=npm) ![Bundle](https://img.shields.io/bundlephobia/minzip/petfolio?color=10b981)

## Quick Start

### NPM

```bash
npm install petfolio
```

```js
import { Petfolio } from 'petfolio';

// One line — creates a fullscreen overlay with the pet
const pet = Petfolio.summon();
```

### CDN (Script Tag)

```html
<script src="https://unpkg.com/petfolio"></script>
<script>
  const pet = Petfolio.summon();
</script>
```

That's it! The pet appears on your page and starts playing random animations.

## Options

```js
const pet = Petfolio.summon({
  autoStart: true,    // Start auto-pilot immediately (default: true)
  scale: 0.95,        // Sprite scale (default: 0.95)
});
```

## Interaction

- **Drag** the pet with your mouse — it reacts to speed and direction
- **Throw** it — it falls with gravity and bounces
- **Right-click** the pet for the menu: avatar switch · chat · settings · exit. Click the pet while it peeks from the screen edge to call it back.

## API

```js
// Change state manually
pet.changeState('walk-right');
pet.changeState('sit');

// Auto-pilot
pet.startAuto();     // Start random behavior
pet.stopAuto();      // Stop and idle
pet.toggleAuto();    // Toggle on/off
pet.isAuto;          // Check if auto-pilot is running

// Cleanup
pet.destroy();       // Remove pet and clean up
```

### Cute messages

Besides the `say_hi` animation (which shows a random short message instead of a fixed greeting), the
pet says something cute by itself every 12–30 seconds, whatever it is doing: walking, climbing, sitting.
The bubble stays up ~3.5 s and rides along with the pet. It stays quiet while the pet is being held,
while the chat is open, and while it is off-screen.

```js
Petfolio.summon({
  phrases: ['Hi hi! 💕', 'Boop!', 'Snack time? 🍪'],   // your own lines (default: ~30 built in, src/phrases.js)
  chatter: { min: 20, max: 60 },                       // seconds between messages; false = only say_hi
});
```

## AI chat

Right-click → chat bubble. The pet answers visitors' questions about your site using only your own
content, so it stays on topic and doesn't make things up.

While the chat is open the pet freezes on its SayHi frame and the chat box takes the place of the
SayHi speech bubble (same spot, growing the way the pet faces). If it was on a wall or the ceiling it
drops to the floor first; if it was peeking from the edge it walks back in. The box follows the pet if
you drag it. Closing the chat (× or Escape) sets it free again.

**1. Build the knowledge base** — run `petfolio-cli` in your project. It scans your source for
human-readable text and writes `public/petfolio-knowledgeBase.json` (and stores your key in `.env`).

**2. Point the widget at it**

```js
Petfolio.summon({
  name: 'Mishi',
  ai: {
    knowledge: '/petfolio-knowledgeBase.json', // default
    endpoint: '/api/petfolio',                 // recommended — see below
  },
});
```

For each question the widget picks the few most relevant chunks of the knowledge base (TF·IDF, no
embeddings, runs in the browser), sends them to the model with the last few messages, and shows the
answer. Free tiers (Groq `llama-3.1-8b-instant` by default; `provider: 'gemini'` also works) are plenty.

**3. Keep the API key private.** Anything in browser code is public, so for a real site use a tiny
server route that holds the key (the `PETFOLIO_GROQ_API_KEY` the CLI wrote to `.env`):

```js
// api/petfolio.js  (Vercel-style; adapt to Netlify/Express/Cloudflare)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length > 20) return res.status(400).end();
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PETFOLIO_GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, temperature: 0.3, max_tokens: 350 }),
  });
  res.status(r.status).json(await r.json());
}
```

Add rate limiting there if the site is public. **For local testing only**, omit `endpoint` and paste a
key into the chat panel (or pass `ai: { apiKey }`): it is kept in that browser's `localStorage` and is
visible to anyone using that browser — never ship a key this way.

| `ai` option | Meaning |
|---|---|
| `knowledge` | URL of the knowledge base, or the data inline (default `/petfolio-knowledgeBase.json`) |
| `endpoint` | Your proxy route (key stays server-side) |
| `apiKey` | Direct mode, dev only |
| `provider` / `model` | `'groq'` (default) or `'gemini'`; override the model name |

The chat opens with three starter questions ("What do you do?", …). Replace them with
`Petfolio.summon({ suggestions: ['Tell me about your work', …] })`, or pass `suggestions: []` for none.
`Enter` sends, `Shift+Enter` adds a new line, and the ↻ button in the header starts a new conversation.

`Petfolio.summon({ ui: false })` hides the menu and chat entirely.

## States

Auto-pilot picks everything (walking, running, sitting, climbing walls and the ceiling, jumping, …).
`pet.changeState(name)` accepts any Shimeji behaviour name (`ClimbAlongWall`, `JumpFromRightWall`,
`RunAndGrabBottomLeftWall`, …) plus these short names:

| State | Description |
|---|---|
| `idle` | Stand still |
| `sit` | Sit down |
| `say_hi` | Walk with a random cute message in a speech bubble |
| `summon` | Fall-from-sky entrance |
| `tv_clone` / `remove_cap` | Extra animations |

## Development

```bash
# Dev server with hot reload
npm run dev

# Build the sandbox
npm run build

# Build the NPM library (ES + UMD)
npm run build:lib

# Regenerate inlined sprites
npm run inline-sprites
```

## Project Structure

```
src/
├── index.js          ← NPM entry-point (Petfolio.summon())
├── Petfolio.js       ← Pixi renderer + public API (25 fps fixed-step loop)
├── constants.js      ← Rendering & host tuning
├── textures.js       ← sprite number → texture
├── bubble.js         ← Speech bubble factory
├── interaction.js    ← Pointer → engine (drag / throw)
├── ai/               ← knowledge search + chat client (no DOM)
├── ui/               ← right-click icon bar, avatar picker, chat panel
├── engine/           ← Shimeji engine port (no Pixi/DOM)
│   ├── animation.js, actions.js, behavior.js, mascot.js, environment.js
│   └── shime-config.js  ← actions.xml + behaviors.xml as JS
└── main.js           ← Sandbox entry-point
test/                 ← headless engine + AI tests
```

## License

MIT
## Animation engine (Shimeji port)

Movement is driven by `packages/petfolio/src/engine/`, a port of the original Shimeji engine:
25 ticks/second, `Pose` (sprite + per-tick velocity + duration) → `Animation` → `Action`
(Stay / Move / Jump / Fall / Dragged / Sequence / Select) → `Behavior`. Auto-pilot is Shimeji's own
weighted-random "next behaviour" picker with floor/wall/ceiling conditions; the numbers live in
`engine/shime-config.js` (a port of `actions.xml` + `behaviors.xml`). Any Shimeji behaviour
name (`ClimbAlongWall`, `JumpFromRightWall`, …) can be passed to `pet.changeState()`.

- `Petfolio.summon({ idleScale: 0.3 })` shortens Shimeji's long stand/sit periods (default `1` = original).
- `pet.chaseMouse()` makes it follow the pointer.
- Engine tests (headless): `cd packages/petfolio && node --test test/`
