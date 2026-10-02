/**
 * Headless tests for the Shimeji-style engine.
 *
 *   node --test test/
 *
 * The engine has no DOM/Pixi dependency, so we drive it with a fake
 * viewport and a seeded random generator and assert on what a user would
 * actually see: where the mascot is and which behaviours it plays.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TICK_MS } from '../src/engine/index.js';
import { Animation, pose } from '../src/engine/animation.js';

// ── helpers ─────────────────────────────────────────────────

/** mulberry32 — small deterministic PRNG */
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

function makeWorld(seed = 1, view = VIEW, opts = {}) {
  Math.random = seeded(seed);
  const world = createWorld(() => view, opts);
  const { mascot, env, config } = world;
  mascot.anchor.x = Math.round(view.width / 2);
  mascot.anchor.y = Math.round(view.height / 2);
  mascot.setBehavior(config.buildBehavior('Fall'));
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) { env.tick(); mascot.tick(); }
  };
  return { ...world, step, view };
}

const where = (m, env) => ({
  floor:   env.workArea.bottomBorder.isOn(m.anchor),
  ceiling: env.workArea.topBorder.isOn(m.anchor),
  wall:    env.workArea.leftBorder.isOn(m.anchor) || env.workArea.rightBorder.isOn(m.anchor),
});

// ── animation model ─────────────────────────────────────────

test('Animation picks the pose from elapsed time, looping', () => {
  const a = new Animation([pose(1, 64, 128, -2, 0, 6), pose(2, 64, 128, 0, 0, 4)]);
  assert.equal(a.duration, 10);
  assert.equal(a.poseAt(0).img, 1);
  assert.equal(a.poseAt(5).img, 1);
  assert.equal(a.poseAt(6).img, 2);
  assert.equal(a.poseAt(9).img, 2);
  assert.equal(a.poseAt(10).img, 1);   // wraps
});

test('Pose velocity is mirrored when the mascot looks right', () => {
  const p = pose(1, 64, 128, -2, 0, 6);
  const m = { anchor: { x: 100, y: 0 }, lookRight: false };
  p.apply(m); assert.equal(m.anchor.x, 98);
  m.lookRight = true;
  p.apply(m); assert.equal(m.anchor.x, 100);
});

// ── falling / landing ───────────────────────────────────────

test('spawned mid-air, the mascot falls and lands exactly on the floor', () => {
  const { mascot, env, step, view } = makeWorld(3);
  step(60);
  assert.equal(mascot.anchor.y, view.height);
  assert.ok(where(mascot, env).floor);
  step(400);                                       // Fall includes a 4–8 s stand, then auto-pilot takes over
  assert.notEqual(mascot.behaviorName, 'Fall');
});

test('Fall obeys gravity with terminal velocity (≤ 20 px/tick)', () => {
  const { mascot, step } = makeWorld(3);
  let prev = mascot.anchor.y, maxDy = 0;
  for (let i = 0; i < 60 && mascot.behaviorName === 'Fall'; i++) {
    step(1);
    maxDy = Math.max(maxDy, mascot.anchor.y - prev);
    prev = mascot.anchor.y;
  }
  assert.ok(maxDy > 5 && maxDy <= 21, `max per-tick fall was ${maxDy}`);
});

// ── walking: stepping speed comes from the poses ────────────

test('Walk moves 2 px/tick (50 px/s) with Shimeji stride poses', () => {
  const { mascot, config, step, view } = makeWorld(5);
  step(100);                              // land
  mascot.anchor.x = 300; mascot.anchor.y = view.height;
  mascot.setBehavior(config.buildBehavior('WalkAlongWorkAreaFloor'));
  const x0 = mascot.anchor.x;
  step(10);
  assert.equal(Math.abs(mascot.anchor.x - x0), 20);
  assert.equal(mascot.behaviorName, 'WalkAlongWorkAreaFloor');
});

test('Creep alternates pauses and strides (pose velocities)', () => {
  const { mascot, config, step, view } = makeWorld(5);
  step(100);
  mascot.anchor.x = 300; mascot.anchor.y = view.height;
  mascot.setBehavior(config.buildBehavior('CrawlAlongWorkAreaFloor'));
  const xs = [];
  for (let i = 0; i < 64; i++) { step(1); xs.push(mascot.anchor.x); }
  assert.equal(xs[20], xs[0], 'first 28 ticks are a pause');
  assert.notEqual(xs[40], xs[27], 'then it creeps');
});

// ── jumping ─────────────────────────────────────────────────

test('JumpFromRightWall: arcs through the air and grabs the wall', () => {
  const { mascot, config, env, step, view } = makeWorld(7);
  step(100);
  mascot.anchor.x = view.width - 300; mascot.anchor.y = view.height;
  mascot.setBehavior(config.buildBehavior('JumpFromRightWall'));

  let sawAir = false, minY = Infinity;
  for (let i = 0; i < 400 && !(mascot.anchor.x === view.width && mascot.behaviorName === 'JumpFromRightWall' && where(mascot, env).wall); i++) {
    step(1);
    if (!where(mascot, env).floor && !where(mascot, env).wall) sawAir = true;
    minY = Math.min(minY, mascot.anchor.y);
  }
  assert.ok(sawAir, 'was airborne during the jump');
  assert.ok(minY < view.height - 40, 'jump rose above the floor (arc)');
  assert.equal(mascot.anchor.x, view.width, 'landed exactly on the right wall');
  assert.ok(where(mascot, env).wall);
  assert.equal(mascot.lookRight, true, 'faces the wall it grabbed');
});

test('JumpFromLeftWall (rare in auto-pilot, so driven directly) lands on the left wall', () => {
  const { mascot, config, env, step, view } = makeWorld(8);
  mascot.autoEnabled = false;
  step(100);
  mascot.anchor.x = 250; mascot.anchor.y = view.height;
  mascot.setBehavior(config.buildBehavior('JumpFromLeftWall'));
  step(120);
  assert.equal(mascot.anchor.x, 0);
  assert.ok(where(mascot, env).wall);
  assert.equal(mascot.lookRight, false, 'faces the left wall');
});

// ── walls & ceiling ─────────────────────────────────────────

test('RunAndGrab + ClimbAlongWall reaches the ceiling and crawls along it', () => {
  const { mascot, config, env, step, view } = makeWorld(9);
  mascot.autoEnabled = false;
  step(100);
  mascot.anchor.x = 640; mascot.anchor.y = view.height;
  mascot.setBehavior(config.buildBehavior('RunAndGrabBottomRightWall'));
  step(400);
  assert.ok(where(mascot, env).wall);
  mascot.setBehavior(config.buildBehavior('ClimbAlongWall'));
  let onCeiling = false;
  for (let i = 0; i < 3000; i++) {
    step(1);
    if (where(mascot, env).ceiling) { onCeiling = true; break; }
  }
  assert.ok(onCeiling, 'ended up on the ceiling');
  void view;
});

test('FallFromWall / FallFromCeiling drop the mascot back to the floor', () => {
  for (const name of ['FallFromWall', 'FallFromCeiling']) {
    const { mascot, config, env, step, view } = makeWorld(11);
    mascot.autoEnabled = false;                    // deterministic: hold once landed
    step(100);
    if (name === 'FallFromWall') { mascot.anchor.x = view.width; mascot.anchor.y = 300; mascot.lookRight = true; }
    else { mascot.anchor.x = 500; mascot.anchor.y = 0; }
    mascot.setBehavior(config.buildBehavior(name));
    step(300);
    assert.ok(where(mascot, env).floor, `${name} should end on the floor`);
  }
});

// ── dragging & throwing ─────────────────────────────────────

test('Dragged follows the cursor (feet 120 px below it) and Thrown flies on release', () => {
  const { mascot, config, env, step, view } = makeWorld(13);
  step(100);
  env.cursor.moveTo(400, 300); step(1);
  mascot.dragging = true;
  mascot.setBehavior(config.buildBehavior('Dragged'));
  env.cursor.moveTo(500, 300); step(2);
  assert.equal(mascot.anchor.x, 500);
  assert.equal(mascot.anchor.y, 420);
  assert.equal(mascot.lookRight, false);

  // fling right
  for (let x = 500; x <= 560; x += 20) { env.cursor.moveTo(x, 300); step(1); }
  mascot.dragging = false;
  mascot.setBehavior(config.buildBehavior('Thrown'));
  const x0 = mascot.anchor.x;
  step(10);
  assert.ok(mascot.anchor.x > x0 + 50, 'thrown right with the cursor velocity');
  step(300);
  assert.ok(where(mascot, env).floor || where(mascot, env).wall);
  void view;
});

test('Thrown hard into the right wall grabs it (does not bounce)', () => {
  const { mascot, config, env, step, view } = makeWorld(15);
  step(100);
  mascot.anchor.x = view.width - 100; mascot.anchor.y = 300;
  env.cursor.moveTo(0, 0); step(1);
  // simulate a fast rightward flick
  for (let i = 0; i < 5; i++) { env.cursor.moveTo(i * 30, 300); step(0); env.tick(); }
  mascot.setBehavior(config.buildBehavior('Thrown'));
  let grabbed = false;
  for (let i = 0; i < 60; i++) {
    step(1);
    if (mascot.anchor.x === view.width && where(mascot, env).wall) { grabbed = true; break; }
  }
  assert.ok(grabbed, 'stuck to the right wall');
});

test('held for a long time the mascot resists, then breaks free and falls', () => {
  const { mascot, config, env, step } = makeWorld(17);
  step(100);
  env.cursor.moveTo(600, 200); step(1);
  mascot.dragging = true;
  mascot.setBehavior(config.buildBehavior('Dragged'));
  let freed = false;
  for (let i = 0; i < 2000; i++) {
    step(1);
    if (!mascot.dragging) { freed = true; break; }
  }
  assert.ok(freed, 'dragging flag cleared once it breaks free');
  assert.equal(mascot.behaviorName, 'Fall');
});

// ── auto-pilot ──────────────────────────────────────────────

test('auto-pilot never gets stuck and explores many behaviours', () => {
  const seen = new Map();
  const frames = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const { mascot, env, step, view } = makeWorld(seed);
    mascot.onBehavior = (n) => seen.set(n, (seen.get(n) ?? 0) + 1);
    for (let t = 0; t < 25 * 60 * 10; t++) {          // 10 simulated minutes
      step(1);
      const a = mascot.anchor;
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y), 'finite anchor');
      assert.ok(a.x >= -1 && a.x <= view.width + 1, `x in range, got ${a.x} during ${mascot.behaviorName}`);
      assert.ok(a.y >= -300 && a.y <= view.height + 1, `y in range, got ${a.y} during ${mascot.behaviorName}`);
      if (mascot.pose) frames.add(mascot.pose.img);
    }
  }
  for (const must of ['StandUp', 'SitDown', 'WalkAlongWorkAreaFloor', 'RunAlongWorkAreaFloor',
    'ClimbAlongWall', 'HoldOntoWall', 'ClimbAlongCeiling', 'JumpFromRightWall',
    'FallFromWall', 'FallFromCeiling', 'Fall', 'SitWhileDanglingLegs']) {
    assert.ok(seen.has(must), `auto-pilot should have played ${must}; saw ${[...seen.keys()].join(', ')}`);
  }
  assert.ok(frames.size >= 20, `used ${frames.size} distinct sprite frames`);
});

test('with auto-pilot off the mascot holds still after landing', () => {
  const { mascot, env, step, view } = makeWorld(21);
  mascot.autoEnabled = false;
  step(300);
  assert.equal(mascot.anchor.y, view.height);
  assert.equal(mascot.behaviorName, 'Idle');
  const x = mascot.anchor.x;
  step(500);
  assert.equal(mascot.anchor.x, x);
  void env;
});

test('shrinking the viewport under the mascot makes it fall back to the floor', () => {
  const view = { width: 1280, height: 720 };
  const { mascot, env, step } = makeWorld(23, view);
  step(100);
  view.height = 500;
  step(100);
  assert.equal(mascot.anchor.y, 500);
  assert.ok(where(mascot, env).floor);
});

test('exit walks off-screen and freezes in the peek pose; enter walks back in', () => {
  const { mascot, config, env, step, view } = makeWorld(25);
  mascot.autoEnabled = false;
  step(100);
  mascot.setBehavior(config.buildBehavior('ExitRight'));
  step(600);
  assert.equal(mascot.behaviorName, 'PeekRight');
  assert.ok(mascot.anchor.x > view.width - 40, 'mostly hidden past the right edge');
  const snapshot = { ...mascot.anchor };
  step(200);
  assert.deepEqual(mascot.anchor, snapshot, 'frozen while peeking');

  mascot.setBehavior(config.buildBehavior('EnterRight'));
  step(400);
  assert.ok(mascot.anchor.x < view.width - 100, 'walked back into view');
  assert.ok(where(mascot, env).floor);
});

test('tick rate constant matches Shimeji (25 fps)', () => {
  assert.equal(TICK_MS, 40);
});

// ── chat pose ───────────────────────────────────────────────

test('Chat holds one frame on the floor indefinitely, even with auto-pilot on', () => {
  const { mascot, env, config, step } = makeWorld(11);
  mascot.autoEnabled = true;
  step(600);                                            // land, let auto-pilot run a while
  // Wait until it is standing on the floor, then ask it to chat.
  for (let i = 0; i < 5000 && !env.floor.isOn(mascot.anchor); i++) step(1);
  assert.ok(env.floor.isOn(mascot.anchor));
  mascot.setBehavior(config.buildBehavior('Chat'));
  const x = mascot.anchor.x;
  const imgs = new Set();
  for (let i = 0; i < 5000; i++) { step(1); imgs.add(mascot.pose.img); }   // 200 s
  assert.equal(mascot.behaviorName, 'Chat');
  assert.equal(mascot.anchor.x, x);
  assert.deepEqual([...imgs], [34]);   // the SayHi frame
});

test('Chat falls (not freezes) if the floor disappears under it', () => {
  const { mascot, config, step, view } = makeWorld(12);
  step(300);
  mascot.setBehavior(config.buildBehavior('Chat'));
  step(5);
  view.height += 200;                                   // window grows: floor moves down
  step(200);
  assert.equal(mascot.anchor.y, view.height);
});

test('Descend lets go of a wall or the ceiling and lands on the floor', () => {
  for (const [label, x, y] of [['left wall', 0, 300], ['right wall', VIEW.width, 300], ['ceiling', 500, 0]]) {
    const { mascot, env, config, step } = makeWorld(21);
    mascot.autoEnabled = false;
    mascot.anchor.x = x; mascot.anchor.y = y;
    mascot.setBehavior(config.buildBehavior('Descend'));
    step(300);
    assert.ok(env.floor.isOn(mascot.anchor), `${label}: ended on the floor (${mascot.anchor.x},${mascot.anchor.y})`);
  }
});

// ── phrases ─────────────────────────────────────────────────

test('SayHi says a different cute phrase each time (never "Hi there")', () => {
  const said = [];
  for (let seed = 1; seed <= 25; seed++) {
    const { mascot, config, step } = makeWorld(seed);
    mascot.autoEnabled = false;
    step(300);
    mascot.onSay = (t) => said.push(t);
    mascot.setBehavior(config.buildBehavior('SayHi'));
    step(5);
  }
  assert.equal(said.length, 25);
  assert.ok(new Set(said).size >= 8, `expected variety, got ${new Set(said).size}`);
  assert.ok(said.every((t) => typeof t === 'string' && t.length > 0 && t.length <= 40), 'short, non-empty');
  assert.ok(!said.some((t) => /hi there/i.test(t)));
});

test('phrasePicker never repeats back to back and honours a custom list', async () => {
  const { phrasePicker, DEFAULT_PHRASES } = await import('../src/phrases.js');
  Math.random = seeded(5);
  const pick = phrasePicker(['a', 'b', 'c']);
  let prev = null;
  for (let i = 0; i < 200; i++) { const p = pick(); assert.notEqual(p, prev); prev = p; }
  assert.equal(phrasePicker(['only'])(), 'only');
  assert.ok(DEFAULT_PHRASES.every((p) => p.length <= 40));
  assert.ok(DEFAULT_PHRASES.includes(phrasePicker([])()));          // empty list falls back
});
