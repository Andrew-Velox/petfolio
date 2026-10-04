/**
 * Headless tests for page physics: the collision map, ledges in the engine and the mode governor.
 *
 *   node --test test/
 *
 * Like engine.test.mjs, no DOM and no Pixi: a fake viewport, a fake scroll position and a
 * seeded random generator.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/engine/index.js';
import { LEDGE_MIN_Y } from '../src/engine/environment.js';
import { CORNER_BEHAVIORS } from '../src/engine/shime-config.js';
import { selectPlatforms, platformsChanged } from '../src/engine/platforms.js';
import {
  PhysicsGovernor, normalizeMode, NARROW_VIEWPORT, MIN_PLATFORMS,
  CHURN_LIMIT, FALL_LIMIT, COOLDOWN_MS,
} from '../src/engine/physics-mode.js';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIEW = { width: 1280, height: 720 };
const plat = (id, left, top, right, extra = {}) => ({ id, left, top, right, fixed: false, forced: false, ...extra });

/** A world with a scrollable page and a collision map. The mascot starts mid-air at (x, y). */
function makeLedgeWorld({ seed = 1, platforms = [], x = 640, y = 100, view = VIEW } = {}) {
  Math.random = seeded(seed);
  const scroll = { x: 0, y: 0 };
  const world = createWorld(() => view, { getScroll: () => scroll });
  const { mascot, env, config } = world;
  env.setPlatforms(platforms);
  mascot.anchor.x = x;
  mascot.anchor.y = y;
  mascot.setBehavior(config.buildBehavior('Fall'));
  const step = (n = 1) => { for (let i = 0; i < n; i++) { env.tick(); mascot.tick(); } };
  const until = (pred, max = 2000) => { for (let i = 0; i < max; i++) { if (pred()) return i; step(); } return -1; };
  return { ...world, scroll, step, until, view };
}

const onBottom = (w) => w.env.workArea.bottomBorder.isOn(w.mascot.anchor);

// ── the collision map ───────────────────────────────────────

test('selectPlatforms drops tiny, thin and broken rectangles', () => {
  const out = selectPlatforms([
    { id: 'ok',     left: 100, top: 300, right: 500, bottom: 340 },
    { id: 'narrow', left: 100, top: 400, right: 150, bottom: 440 },
    { id: 'thin',   left: 100, top: 500, right: 500, bottom: 504 },
    { id: 'nan',    left: NaN, top: 600, right: 500, bottom: 640 },
    { id: 'flip',   left: 500, top: 700, right: 100, bottom: 740 },
  ]);
  assert.deepEqual(out.map((p) => p.id), ['ok']);
});

test('selectPlatforms merges a container with its first child (same top edge)', () => {
  const out = selectPlatforms([
    { id: 'section', left: 0,   top: 300, right: 1000, bottom: 900 },
    { id: 'p',       left: 100, top: 302, right: 900,  bottom: 360 },
    { id: 'p2',      left: 100, top: 420, right: 900,  bottom: 480 },
  ]);
  assert.deepEqual(out.map((p) => p.id), ['section', 'p2']);   // the wider one wins, the lower paragraph stays
});

test('selectPlatforms keeps forced platforms (even small) and caps the count by width', () => {
  const small = { id: 'btn', left: 10, top: 200, right: 40, bottom: 210, forced: true };
  assert.deepEqual(selectPlatforms([small]).map((p) => p.id), ['btn']);

  const many = Array.from({ length: 30 }, (_, i) => ({ id: i, left: 0, top: 100 + i * 50, right: 100 + i * 10, bottom: 130 + i * 50 }));
  const capped = selectPlatforms([...many, small], { max: 5 });
  assert.equal(capped.length, 5);
  assert.ok(capped.some((p) => p.id === 'btn'), 'forced survives the cap');
  assert.ok(capped.every((p, i) => i === 0 || capped[i - 1].top <= p.top), 'still sorted top to bottom');
});

test('selectPlatforms does not merge fixed and page ledges that share coordinates', () => {
  const out = selectPlatforms([
    { id: 'nav', left: 0, top: 200, right: 800, bottom: 260, fixed: true },
    { id: 'p',   left: 0, top: 200, right: 800, bottom: 260 },
  ]);
  assert.equal(out.length, 2);
});

test('platformsChanged ignores 1–2 px noise but sees real movement', () => {
  const a = [plat(1, 0, 300, 500)];
  assert.equal(platformsChanged(a, [plat(1, 1, 301, 499)]), false);
  assert.equal(platformsChanged(a, [plat(1, 0, 340, 500)]), true);
  assert.equal(platformsChanged(a, [plat(2, 0, 300, 500)]), true);
  assert.equal(platformsChanged(a, []), true);
});

// ── landing and one-way ledges ──────────────────────────────

test('a falling mascot lands exactly on a ledge below it', () => {
  const w = makeLedgeWorld({ platforms: [plat('a', 400, 400, 900)], x: 600, y: 120 });
  w.until(() => w.env.ledge);
  assert.equal(w.mascot.anchor.y, 400);
  assert.equal(w.env.ledge.id, 'a');
  assert.ok(w.env.floor.isOn(w.mascot.anchor));
  assert.ok(!onBottom(w));
});

test('ledges are one-way: below the ledge the mascot falls past it to the floor', () => {
  // The old 80 px floor look-back would have pulled it up onto the ledge.
  const w = makeLedgeWorld({ platforms: [plat('a', 400, 400, 900)], x: 600, y: 440 });
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
});

test('a mascot beside a ledge falls to the floor', () => {
  const w = makeLedgeWorld({ platforms: [plat('a', 400, 400, 900)], x: 200, y: 100 });
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
});

test('ledges too high (head cut off) or at the floor are not landable', () => {
  const w = makeLedgeWorld({
    platforms: [plat('top', 400, LEDGE_MIN_Y - 20, 900), plat('almost-floor', 400, VIEW.height - 10, 900)],
    x: 600, y: 0,
  });
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
  assert.equal(w.env.ledge, null);
});

test('removing the map drops a standing mascot to the floor', () => {
  const w = makeLedgeWorld({ platforms: [plat('a', 400, 400, 900)], x: 600, y: 120 });
  w.until(() => w.env.ledge);
  w.env.setPlatforms([]);
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
});

test('without a map nothing changes: the world behaves as floor-only physics', () => {
  const w = makeLedgeWorld({ x: 600, y: 100 });
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
  assert.equal(w.env.ledge, null);
});

// ── scrolling ───────────────────────────────────────────────

function standOnLedge(extra = {}) {
  const w = makeLedgeWorld({ platforms: [plat('a', 300, 500, 1000)], x: 600, y: 120, ...extra });
  w.mascot.autoEnabled = false;
  w.until(() => w.env.ledge);
  return w;
}

test('scrolling carries a mascot standing on a ledge with it', () => {
  const w = standOnLedge();
  w.scroll.y = 60;
  w.step();
  assert.equal(w.mascot.anchor.y, 440);                 // 500 - 60
  assert.equal(w.env.ledge?.y, 440);
  assert.ok(w.env.carried);
  w.scroll.y = 0;
  w.step();
  assert.equal(w.mascot.anchor.y, 500);
  assert.equal(w.env.ledge?.id, 'a');
});

test('scroll carry is also exposed per frame (renderShift)', () => {
  const w = standOnLedge();
  w.step();
  w.scroll.y = 17;                                      // scrolled since the last tick, not yet carried
  assert.deepEqual(w.env.renderShift(), { x: 0, y: -17 });
});

test('a ledge that scrolls above the top is left behind: the mascot falls to the floor', () => {
  const w = standOnLedge();
  w.scroll.y = 500 - (LEDGE_MIN_Y - 10);                // ledge now at y = LEDGE_MIN_Y - 10
  w.step();
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
  assert.ok(!w.env.carried);
});

test('a ledge that scrolls below the viewport is left behind too', () => {
  const w = makeLedgeWorld({ platforms: [plat('a', 300, 900, 1000)], x: 600, y: 100 });
  w.scroll.y = 500;                                     // ledge at y = 400
  w.until(() => w.env.ledge);
  assert.equal(w.mascot.anchor.y, 400);
  w.scroll.y = 0;                                       // ledge at y = 900, off the bottom
  w.step();
  assert.equal(w.env.ledge, null);
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
});

test('fixed platforms ignore scrolling', () => {
  const w = makeLedgeWorld({ platforms: [plat('nav', 300, 300, 1000, { fixed: true })], x: 600, y: 120 });
  w.mascot.autoEnabled = false;
  w.until(() => w.env.ledge);
  w.scroll.y = 400;
  w.step();
  assert.equal(w.mascot.anchor.y, 300);
  assert.ok(!w.env.carried);
  assert.deepEqual(w.env.renderShift(), { x: 0, y: 0 });
});

test('a layout shift moves the mascot with its ledge; a vanished ledge drops it', () => {
  const w = standOnLedge();
  w.env.setPlatforms([plat('a', 300, 530, 1000)]);      // content above grew by 30 px
  assert.equal(w.mascot.anchor.y, 530);
  w.step();
  assert.equal(w.env.ledge?.id, 'a');
  w.env.setPlatforms([plat('b', 300, 800, 1000)]);      // 'a' is gone (and nothing else is under the pet)
  w.step();
  assert.equal(w.env.ledge, null);
  w.until(() => onBottom(w));
  assert.equal(w.mascot.anchor.y, VIEW.height);
});

// ── behaviour on ledges ─────────────────────────────────────

test('on a ledge the pet walks along it but never off the ends by accident', () => {
  const w = makeLedgeWorld({ seed: 5, platforms: [plat('a', 300, 500, 700)], x: 400, y: 120 });
  w.until(() => w.env.ledge);
  // Collect what it does while it stays on the ledge.
  const names = new Set();
  const xs = [];
  for (let i = 0; i < 3000 && w.env.ledge; i++) {
    w.step();
    names.add(w.mascot.behaviorName);
    if (w.mascot.anchor.y === 500) xs.push(w.mascot.anchor.x);
  }
  assert.ok(Math.max(...xs) - Math.min(...xs) > 50, 'it walked along the ledge');
  assert.ok([...names].some((n) => /Ledge/.test(n)), `ledge behaviours were used: ${[...names]}`);
  assert.ok(xs.every((x) => x >= 300 && x <= 700), 'stayed within the ledge while on it');
});

test('auto-pilot with a busy map never gets stuck or lost (invariants over 20 000 ticks)', () => {
  const platforms = [
    plat('p1', 100, 220, 600), plat('p2', 700, 330, 1200), plat('p3', 200, 450, 800), plat('p4', 0, 580, 1280),
    plat('nav', 0, 160, 1280, { fixed: true }),
  ];
  const everSeen = new Set();
  for (const seed of [1, 2, 3]) {
    const w = makeLedgeWorld({ seed, platforms, x: 640, y: 0 });
    let lastProgress = 0;
    let lastKey = '';
    for (let i = 0; i < 20000; i++) {
      w.step();
      const a = w.mascot.anchor;
      everSeen.add(w.mascot.behaviorName);
      // never far below the floor
      assert.ok(a.y <= VIEW.height + 400, `seed ${seed} tick ${i}: fell out of the world (${a.x},${a.y}) in ${w.mascot.behaviorName}`);
      const key = `${w.mascot.behaviorName}|${a.x}|${a.y}`;
      if (key !== lastKey) { lastKey = key; lastProgress = i; }
      assert.ok(i - lastProgress < 3000, `seed ${seed}: frozen for 3000 ticks in ${w.mascot.behaviorName}`);
    }
  }
  for (const name of ['JumpToLedge', 'StepOffLedge', 'WalkAlongLedge', 'SitOnLedgeEdge']) {
    assert.ok(everSeen.has(name), `${name} was used (saw: ${[...everSeen].join(', ')})`);
  }
});

test('Descend from a ledge with an edge steps off it and lands on the floor', () => {
  const w = makeLedgeWorld({ platforms: [plat('a', 300, 500, 700)], x: 400, y: 120 });
  w.mascot.autoEnabled = false;
  w.until(() => w.env.ledge);
  w.mascot.setBehavior(w.config.buildBehavior('Descend'));
  const t = w.until(() => onBottom(w), 1500);
  assert.ok(t >= 0, 'reached the floor');
  assert.equal(w.mascot.anchor.y, VIEW.height);
});

test('Descend from a ledge as wide as the page drops through it', () => {
  const w = makeLedgeWorld({ platforms: [plat('wide', -50, 500, 1400)], x: 600, y: 120 });
  w.mascot.autoEnabled = false;
  w.until(() => w.env.ledge);
  w.mascot.setBehavior(w.config.buildBehavior('Descend'));
  const t = w.until(() => onBottom(w), 1500);
  assert.ok(t >= 0, 'reached the floor through the ledge');
  assert.equal(w.env.dropFrom, null, 'the pass-through flag is cleared again');
});

test('JumpToLedge lands on the ledge above', () => {
  const w = makeLedgeWorld({ platforms: [plat('a', 500, 560, 900)], x: 300, y: 300 });
  w.mascot.autoEnabled = false;
  w.until(() => onBottom(w));
  assert.ok(w.env.jumpTarget(), 'there is a ledge in reach');
  w.mascot.setBehavior(w.config.buildBehavior('JumpToLedge'));
  const t = w.until(() => w.env.ledge, 300);
  assert.ok(t >= 0, 'landed on the ledge');
  assert.equal(w.mascot.anchor.y, 560);
});

test('jumpTarget ignores ledges that are too high, too far or off screen', () => {
  const w = makeLedgeWorld({ platforms: [
    plat('too-high', 500, 150, 900),      // 570 px above the floor
    plat('too-far',  1100, 560, 1270),    // 460 px away
  ], x: 500, y: 0 });
  w.until(() => onBottom(w));
  assert.equal(w.env.jumpTarget(), null);
});

test('a released pet lands on a ledge it is above, and passes through one it is below', () => {
  const release = (cursorY) => {
    const w = makeLedgeWorld({ platforms: [plat('a', 300, 400, 800)], x: 500, y: 600 });
    w.mascot.autoEnabled = false;
    w.until(() => onBottom(w));
    w.env.cursor.moveTo(500, cursorY); w.step(1);
    w.mascot.dragging = true;
    w.mascot.setBehavior(w.config.buildBehavior('Dragged'));
    w.step(3);
    w.mascot.dragging = false;
    w.mascot.setBehavior(w.config.buildBehavior('Thrown'));
    w.until(() => w.env.floor.isOn(w.mascot.anchor), 500);
    return w;
  };
  const above = release(250);                         // feet at 370, ledge top at 400
  assert.equal(above.env.ledge?.id, 'a');
  assert.equal(above.mascot.anchor.y, 400);
  const below = release(330);                         // feet at 450, under the ledge's top edge
  assert.equal(below.env.ledge, null);
  assert.equal(below.mascot.anchor.y, VIEW.height);
});

// ── corner mode ─────────────────────────────────────────────

test('corner mode parks the pet in the corner and only idles', () => {
  const w = makeLedgeWorld({ seed: 4, x: 300, y: 0 });
  w.env.cornerMode = true;
  const names = new Set();
  for (let i = 0; i < 6000; i++) { w.step(); names.add(w.mascot.behaviorName); }
  const allowed = new Set([...CORNER_BEHAVIORS, 'Fall', 'Dragged', 'Thrown']);
  for (const n of names) assert.ok(allowed.has(n), `unexpected behaviour in corner mode: ${n}`);
  assert.ok(Math.abs(w.mascot.anchor.x - (VIEW.width - 90)) <= 10, `parked at the corner (x=${w.mascot.anchor.x})`);
  assert.ok(onBottom(w));
});

// ── mode governor ───────────────────────────────────────────

const GOOD = { width: 1280, touchOnly: false, reducedMotion: false, platformCount: 20 };

test('governor: floor and corner are used as asked; invalid modes mean floor', () => {
  assert.equal(new PhysicsGovernor('floor').evaluate(GOOD, 0).mode, 'floor');
  assert.equal(new PhysicsGovernor('corner').evaluate({ ...GOOD, width: 300 }, 0).mode, 'corner');
  assert.equal(normalizeMode('nonsense'), 'floor');
  assert.equal(normalizeMode(undefined), 'floor');
});

test('governor: page is used on a good desktop page', () => {
  assert.deepEqual(new PhysicsGovernor('page').evaluate(GOOD, 0), { mode: 'page', reason: null });
});

test('governor: page falls back to floor on phones, touch, reduced motion and thin pages', () => {
  const g = new PhysicsGovernor('page');
  assert.deepEqual(g.evaluate({ ...GOOD, width: NARROW_VIEWPORT - 1 }, 0), { mode: 'floor', reason: 'narrow-viewport' });
  assert.deepEqual(g.evaluate({ ...GOOD, touchOnly: true }, 0), { mode: 'floor', reason: 'touch-only' });
  assert.deepEqual(g.evaluate({ ...GOOD, reducedMotion: true }, 0), { mode: 'floor', reason: 'reduced-motion' });
  assert.deepEqual(g.evaluate({ ...GOOD, platformCount: MIN_PLATFORMS - 1 }, 0), { mode: 'floor', reason: 'few-platforms' });
  assert.equal(g.evaluate({ ...GOOD, platformCount: MIN_PLATFORMS }, 0).mode, 'page');
});

test('governor: a layout that keeps changing drops to floor, then gets another chance', () => {
  const g = new PhysicsGovernor('page');
  for (let i = 0; i < CHURN_LIMIT; i++) g.note('change', 1000 + i * 100);
  assert.deepEqual(g.evaluate(GOOD, 2000), { mode: 'floor', reason: 'unstable' });
  assert.equal(g.evaluate(GOOD, 2000 + COOLDOWN_MS - 1).mode, 'floor');
  assert.equal(g.evaluate(GOOD, 2000 + COOLDOWN_MS + 1).mode, 'page');
});

test('governor: a page that flips between plenty and nothing ends up in the cool-down', () => {
  const g = new PhysicsGovernor('page');
  let t = 0;
  let reason = null;
  for (let i = 0; i < 12 && reason !== 'unstable'; i++) {
    g.evaluate(GOOD, t += 1000);                                       // plenty of surfaces…
    reason = g.evaluate({ ...GOOD, platformCount: 0 }, t += 1000).reason;   // …then none
  }
  assert.equal(reason, 'unstable');
});

test('governor: a bare page (never had surfaces) is just \'few-platforms\', not unstable', () => {
  const g = new PhysicsGovernor('page');
  for (let t = 0; t < 120_000; t += 1000) {
    assert.equal(g.evaluate({ ...GOOD, platformCount: 1 }, t).reason, 'few-platforms');
  }
});

test('governor: spread-out changes are normal and do not trigger the fallback', () => {
  const g = new PhysicsGovernor('page');
  for (let i = 0; i < 40; i++) g.note('change', i * 5000);
  assert.equal(g.evaluate(GOOD, 40 * 5000).mode, 'page');
});

test('governor: a pet that keeps losing its footing drops to floor', () => {
  const g = new PhysicsGovernor('page');
  for (let i = 0; i < FALL_LIMIT; i++) g.note('fall', 500 + i * 1000);
  assert.deepEqual(g.evaluate(GOOD, 6000), { mode: 'floor', reason: 'unstable' });
});

test('governor: request() resets the history', () => {
  const g = new PhysicsGovernor('page');
  for (let i = 0; i < CHURN_LIMIT; i++) g.note('change', i);
  g.evaluate(GOOD, 100);
  g.request('page');
  assert.equal(g.evaluate(GOOD, 101).mode, 'page');
});
