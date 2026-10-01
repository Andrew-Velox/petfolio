# 🐾 Petfolio

Drop-in animated desktop pet for any website. A Shimeji-style PixiJS companion that walks, crawls, jumps, waves, and responds to dragging — all with zero configuration.

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
- **Right-click** to open the control menu (if using the sandbox)

## API

```js
// Change state manually
pet.changeState('walk-right');
pet.changeState('sit');
pet.changeState('wave');

// Auto-pilot
pet.startAuto();     // Start random behavior
pet.stopAuto();      // Stop and idle
pet.toggleAuto();    // Toggle on/off
pet.isAuto;          // Check if auto-pilot is running

// Cleanup
pet.destroy();       // Remove pet and clean up
```

## Available States

| State | Description |
|---|---|
| `idle` | Standing still |
| `walk-left` / `walk-right` | Walking |
| `crawl-left` / `crawl-right` | Belly crawl |
| `crawl_top` | Ceiling crawl |
| `sit` | Sitting |
| `say_hi` | Walking + greeting bubble |
| `wave` | Wave gesture |
| `summon` | Fall-from-sky entrance |
| `jump-grab-right` | Jump arc to right wall |
| `walk-grab-right` | Walk to wall and grab |
| `grab-right` | Wall crawl |
| `tv_clone` | TV clone animation |
| `remove_cap` | Cap removal animation |

## Auto-Pilot

The auto-pilot uses a **state transition table** — each state defines what can come next, and the pet picks randomly. Looping states (walk, sit) play for a random duration; one-shot states (tv_clone, remove_cap) play all frames before transitioning.

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
├── Petfolio.js       ← Main class (state machine, auto-pilot)
├── constants.js      ← Physics & timing constants
├── animations.js     ← Frame mappings (46 sprites)
├── transitions.js    ← Auto-pilot state transition table
├── bubble.js         ← Speech bubble factory
├── interaction.js    ← Drag/throw input handling
├── states/
│   ├── walk.js       ← Walk, crawl, ceiling, say-hi
│   ├── wall.js       ← Wall-grab, jump-to-wall
│   ├── drag.js       ← Drag, fall, landing
│   └── summon.js     ← Summon entrance
└── main.js           ← Sandbox entry-point
```

## License

MIT