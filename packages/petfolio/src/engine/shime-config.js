/**
 * engine/shime-config.js — Shimeji's default actions + behaviours.
 *
 * A line-for-line port of Shimeji-ee's conf/actions.xml and
 * conf/behaviors.xml (poses, velocities, durations and frequencies are the
 * original numbers), minus what has no meaning on a web page:
 *   - the "IE" window actions (walk on / throw / jump off browser windows)
 *   - SplitIntoTwo / PullUpShimeji (they spawn more mascots)
 *
 * Reading guide (XML → here):
 *   <Pose Image="/shime1.png" ImageAnchor="64,128" Velocity="-2,0" Duration="6"/>
 *       →  pose(1, 64, 128, -2, 0, 6)
 *   Duration="${500+Math.random()*1000}"      →  once(() => 500 + Math.random()*1000)
 *   TargetY="#{TargetY < mascot.anchor.y}"    →  dyn(...)  (re-evaluated each tick)
 *   <Condition Condition="…"> group          →  `cond` option on each behaviour
 *
 * Time is in TICKS of 40 ms (25 per second): Duration 250 = 10 s.
 *
 * Petfolio additions (not in Shimeji): Say / Place actions, the
 * SayHi / TvClone / RemoveCap emotes, Exit / Peek / Enter, Summon,
 * Idle / HoldWall / HoldCeiling (what the mascot does when auto-pilot is off)
 * and "user" behaviours (WalkLeft, JumpToRightWall, …) behind the menu.
 */
import { pose, anim } from './animation.js';
import {
  once, dyn, ref, seq, select,
  stay, move, animate, jump, fall, dragged, regist,
} from './actions.js';
import { BehaviorBuilder, Configuration } from './behavior.js';

// Peek / exit geometry (px), see constants.js for what they mean.
const DEFAULTS = {
  idleScale: 1,
  exitOffscreen: 80,
  peekInsetH: 66,
  peekInsetV: 120,
};

// ── tiny helpers ────────────────────────────────────────────

/** pose with the standard (64,128) bottom-centre anchor */
const w = (img, vx, vy, d) => pose(img, 64, 128, vx, vy, d);
/** pose with an explicit anchor */
const wa = (img, ax, ay, vx, vy, d) => pose(img, ax, ay, vx, vy, d);

const area = (m) => m.env.workArea;
const rnd  = () => Math.random();

export function createConfig(userOpts = {}) {
  const o = { ...DEFAULTS, ...userOpts };

  /** `${500+Math.random()*1000}` — the long stand/sit/lie durations, scalable. */
  const longTime  = () => once(() => (500 + rnd() * 1000) * o.idleScale);
  const between   = (lo, span) => once(() => lo + rnd() * span);
  const acrossArea = () => once((m) => area(m).left + 64 + rnd() * (area(m).width - 128));

  // ═══════════════════════════════════════════════════════════
  // ACTIONS — leaf actions (conf/actions.xml, first <ActionList>)
  // ═══════════════════════════════════════════════════════════
  const A = {};

  A.Look   = { kind: 'Look',   params: {} };
  A.Offset = { kind: 'Offset', params: {} };
  A.Place  = { kind: 'Place',  params: {} };
  A.Say    = { kind: 'Say',    params: {} };

  // ── Standing / walking ───────────────────────────────────
  A.Stand = stay('Floor', [anim([w(1, 0, 0, 250)])]);

  const strides = (img2, img3, v, d) => [w(1, v, 0, d), w(img2, v, 0, d), w(1, v, 0, d), w(img3, v, 0, d)];
  A.Walk = move('Floor', [anim(strides(2, 3, -2, 6))]);
  A.Run  = move('Floor', [anim(strides(2, 3, -4, 2))]);
  A.Dash = move('Floor', [anim(strides(2, 3, -8, 2))]);

  // ── Sitting ──────────────────────────────────────────────
  A.Sit            = stay('Floor', [anim([w(11, 0, 0, 250)])]);
  A.SitAndLookAtMouse = stay('Floor', [
    anim([w(26, 0, 0, 250)], (m) => m.env.cursor.y < m.env.screen.height / 2),
    anim([w(11, 0, 0, 250)]),
  ]);
  A.SitAndSpinHeadAction = animate('Floor', [anim([
    w(26, 0, 0, 5), w(15, 0, 0, 5), w(27, 0, 0, 5), w(16, 0, 0, 5),
    w(28, 0, 0, 5), w(17, 0, 0, 5), w(29, 0, 0, 5), w(11, 0, 0, 5),
  ])]);
  A.SitWithLegsUp   = stay('Floor', [anim([wa(30, 64, 112, 0, 0, 250)])]);
  A.SitWithLegsDown = stay('Floor', [anim([wa(31, 64, 112, 0, 0, 250)])]);
  A.SitAndDangleLegs = stay('Floor', [anim([
    wa(31, 64, 112, 0, 0, 5), wa(32, 64, 112, 0, 0, 15),
    wa(31, 64, 112, 0, 0, 5), wa(33, 64, 112, 0, 0, 15),
  ])]);

  // ── Lying / creeping ─────────────────────────────────────
  A.Sprawl = stay('Floor', [anim([w(21, 0, 0, 250)])]);
  A.Creep  = move('Floor', [anim([
    w(20, 0, 0, 28), w(20, -2, 0, 4), w(21, -2, 0, 4), w(21, -1, 0, 4), w(21, 0, 0, 24),
  ])]);

  // ── Ceiling (anchor 64,48: the pose hangs from the top edge) ──
  A.GrabCeiling  = stay('Ceiling', [anim([wa(23, 64, 48, 0, 0, 250)])]);
  const ceilingStride = () => [
    wa(25, 64, 48, 0, 0, 16),
    wa(25, 64, 48, -1, 0, 4), wa(23, 64, 48, -1, 0, 4), wa(24, 64, 48, -1, 0, 4),
    wa(24, 64, 48, 0, 0, 16),
    wa(24, 64, 48, -2, 0, 4), wa(23, 64, 48, -2, 0, 4), wa(25, 64, 48, -2, 0, 4),
  ];
  A.ClimbCeiling = move('Ceiling', [anim(ceilingStride())]);

  // ── Wall ─────────────────────────────────────────────────
  A.GrabWall = stay('Wall', [anim([w(13, 0, 0, 250)])]);
  // Two animations, picked each tick by direction of travel.
  const wallStride = () => [
    anim([
      w(14, 0, 0, 16), w(14, 0, -1, 4), w(12, 0, -1, 4), w(13, 0, -1, 4),
      w(13, 0, 0, 16), w(13, 0, -2, 4), w(12, 0, -2, 4), w(14, 0, -2, 4),
    ], (m, a) => a.int('TargetY', 0) < m.anchor.y),
    anim([
      w(14, 0, 0, 16), w(14, 0, 2, 4), w(12, 0, 2, 4), w(13, 0, 2, 4),
      w(13, 0, 0, 16), w(13, 0, 1, 4), w(12, 0, 1, 4), w(14, 0, 1, 4),
    ], (m, a) => a.int('TargetY', 0) >= m.anchor.y),
  ];
  A.ClimbWall = move('Wall', wallStride());

  // ── Air ──────────────────────────────────────────────────
  A.Jumping = jump([anim([w(22, 0, 0, 250)])], { VelocityParam: 20 });
  A.Falling = fall([anim([w(4, 0, 0, 250)])], { ResistanceX: 0.05, ResistanceY: 0.1, Gravity: 2 });
  A.Bouncing = animate('Floor', [anim([w(18, 0, 0, 4), w(19, 0, 0, 4)])]);
  A.Tripping = animate('Floor', [anim([
    w(19, -8, 0, 8), w(18, -4, 0, 4), w(20, -2, 0, 4), w(20, 0, 0, 10), wa(19, 64, 104, -4, 0, 4),
  ])]);

  // ── Being held ───────────────────────────────────────────
  // Pose follows how far the (spring-damped) foot lags the cursor.
  const foot = (m, a) => a.v('FootX', m.env.cursor.x) - m.env.cursor.x;
  A.Pinched = dragged([
    anim([w(9, 0, 0, 5)],  (m, a) => foot(m, a) < -50),
    anim([w(7, 0, 0, 5)],  (m, a) => foot(m, a) < -30),
    anim([w(5, 0, 0, 5)],  (m, a) => foot(m, a) < -10),
    anim([w(1, 0, 0, 5)],  (m, a) => foot(m, a) >= -10 && foot(m, a) < 10),
    anim([w(6, 0, 0, 5)],  (m, a) => foot(m, a) < 30),
    anim([w(8, 0, 0, 5)],  (m, a) => foot(m, a) < 50),
    anim([w(10, 0, 0, 5)], (m, a) => foot(m, a) >= 50),
  ]);
  const wiggle = (n, d) => Array.from({ length: n }, () => [w(5, 0, 0, d), w(6, 0, 0, d)]).flat();
  A.Resisting = regist([anim([
    ...wiggle(2, 5), w(1, 0, 0, 50),
    ...wiggle(4, 5), w(1, 0, 0, 100),
    ...wiggle(4, 5),
    ...wiggle(4, 2),
  ])]);

  // ═══════════════════════════════════════════════════════════
  // ACTIONS — composite "real" actions (second <ActionList>)
  // ═══════════════════════════════════════════════════════════
  const onFloor = (m) => m.env.floor.isOn(m.anchor);

  A.Fall = seq([
    ref('Falling'),
    select([
      seq([ref('Bouncing'), ref('Stand', { Duration: between(100, 100) })], { Condition: once(onFloor) }),
      ref('GrabWall', { Duration: 100 }),
    ]),
  ]);

  A.Dragged = seq([ref('Pinched'), ref('Resisting')], { Loop: true });

  A.Thrown = seq([
    ref('Falling', {
      InitialVX: once((m) => m.env.cursor.dx),
      InitialVY: once((m) => m.env.cursor.dy),
    }),
    select([
      seq([ref('Bouncing'), ref('Stand', { Duration: between(100, 100) })], { Condition: once(onFloor) }),
      ref('GrabWall', { Duration: 100 }),
    ]),
  ]);

  A.StandUp = seq([ref('Stand', { Duration: longTime() })]);
  A.SitDown = seq([ref('Sit',   { Duration: longTime() })]);
  A.LieDown = seq([ref('Sprawl', { Duration: longTime() })]);

  A.SitWhileDanglingLegs = seq([
    ref('SitWithLegsUp',   { Duration: 10 }),
    ref('SitWithLegsDown', { Duration: between(100, 100) }),
    ref('SitAndDangleLegs', { Duration: once(() => 500 + rnd() * 100) }),
    ref('SitWithLegsDown', { Duration: between(100, 100) }),
    ref('SitWithLegsUp',   { Duration: 10 }),
  ]);

  A.HoldOntoWall = seq([ref('GrabWall', { Duration: longTime() })]);
  // Step one pixel away from the wall (Offset), then `Stand` — which is not
  // on the floor, so it throws LostGround and the mascot falls.
  A.FallFromWall = seq([
    ref('Offset', { X: once((m) => (m.lookRight ? -1 : 1)) }),
    ref('Stand'),
  ]);
  A.HoldOntoCeiling = seq([ref('GrabCeiling', { Duration: longTime() })]);
  A.FallFromCeiling = seq([ref('Offset', { Y: 1 }), ref('Stand')]);

  A.WalkAlongWorkAreaFloor  = seq([ref('Walk',  { TargetX: acrossArea() })]);
  A.RunAlongWorkAreaFloor   = seq([ref('Run',   { TargetX: acrossArea() })]);
  A.CrawlAlongWorkAreaFloor = seq([ref('Creep', { TargetX: acrossArea() })]);

  const settle = (lookRight, how) => [
    ref(how === 'walk' ? 'Walk' : 'Run', {
      TargetX: once((m) => (lookRight
        ? area(m).right - 100 - rnd() * 300
        : area(m).left + 100 + rnd() * 300)),
    }),
    ref('Stand', { Duration: between(20, 20) }),
    ref('Look',  { LookRight: !lookRight }),
    ref('Stand', { Duration: between(20, 20) }),
    ref('Sit',   { Duration: longTime() }),
  ];
  A.WalkLeftAlongFloorAndSit  = seq(settle(false, 'walk'));
  A.WalkRightAlongFloorAndSit = seq(settle(true,  'walk'));
  A.WalkLeftAndSit            = seq(settle(false, 'run'));
  A.WalkRightAndSit           = seq(settle(true,  'run'));

  A.GrabWorkAreaBottomLeftWall  = seq([
    ref('Walk', { TargetX: dyn((m) => area(m).left) }),
    ref('ClimbWall', { TargetY: dyn((m) => area(m).bottom - 64) }),
  ]);
  A.GrabWorkAreaBottomRightWall = seq([
    ref('Walk', { TargetX: dyn((m) => area(m).right) }),
    ref('ClimbWall', { TargetY: dyn((m) => area(m).bottom - 64) }),
  ]);
  A.RunAndGrabBottomLeftWall  = seq([
    ref('Run', { TargetX: dyn((m) => area(m).left) }),
    ref('ClimbWall', { TargetY: dyn((m) => area(m).bottom - 64) }),
  ]);
  A.RunAndGrabBottomRightWall = seq([
    ref('Run', { TargetX: dyn((m) => area(m).right) }),
    ref('ClimbWall', { TargetY: dyn((m) => area(m).bottom - 64) }),
  ]);

  A.ClimbHalfwayAlongWall = seq([
    ref('ClimbWall', {
      TargetY: once((m) => area(m).top + 64 + rnd() * (area(m).height - 128)),
    }),
  ]);

  // Up the wall, over the corner (Offset puts the anchor exactly on the
  // ceiling line), turn around, and crawl a little way along the ceiling.
  // NOTE: Shimeji's XML has `Math.random*100` (a typo that yields NaN → 0,
  // i.e. "crawl across the whole ceiling"). We use the intended
  // `Math.random()*100`.
  A.ClimbAlongWall = seq([
    ref('ClimbWall', { TargetY: dyn((m) => area(m).top + 64) }),
    ref('Offset', { Y: -64 }),
    ref('Look'),
    ref('ClimbCeiling', {
      TargetX: once((m) => (m.lookRight
        ? area(m).left + rnd() * 100
        : area(m).right - rnd() * 100)),
    }),
  ]);
  A.ClimbAlongCeiling = seq([ref('ClimbCeiling', { TargetX: acrossArea() })]);

  const jumpToWall = (right) => seq([
    ref('Jumping', {
      TargetX: once((m) => (right ? area(m).right : area(m).left)),
      TargetY: once((m) => area(m).bottom - rnd() * area(m).height / 4),
    }),
    ref('GrabWall', { Duration: between(100, 100) }),
  ]);
  A.JumpFromLeftWall  = jumpToWall(false);
  A.JumpFromRightWall = jumpToWall(true);

  // Mouse chasing (used by chaseMouse(); Frequency 0 in the auto pool).
  const cx = (m) => m.env.cursor.x;
  A.ChaseMouse = seq([
    seq([ref('Offset', { Y: 1 }), ref('Falling'), ref('Bouncing')],
      { Condition: once((m) => m.env.ceiling.isOn(m.anchor)) }),
    seq([ref('Offset', { X: 1 }), ref('Falling'), ref('Bouncing')],
      { Condition: once((m) => m.env.wall.isOn(m.anchor) && m.env.workArea.leftBorder.isOn(m.anchor)) }),
    seq([ref('Offset', { X: -1 }), ref('Falling'), ref('Bouncing')],
      { Condition: once((m) => m.env.wall.isOn(m.anchor) && m.env.workArea.rightBorder.isOn(m.anchor)) }),
    ref('Dash', { TargetX: once((m) => m.anchor.x + (cx(m) - m.anchor.x) * rnd() / 2) }),
    ref('Tripping', { Condition: once(() => rnd() < 0.05) }),
    ref('Dash', { TargetX: once((m) => m.anchor.x + (cx(m) - m.anchor.x) * rnd()) }),
    ref('Tripping', { Condition: once(() => rnd() < 0.05) }),
    ref('Dash', {
      TargetX: dyn((m, a) => cx(m) + a.v('Gap', 0)),
      Gap: once((m) => (m.anchor.x < cx(m)
        ? -Math.min(cx(m) - m.anchor.x, rnd() * 200)
        : Math.min(m.anchor.x - cx(m), rnd() * 200))),
    }),
    ref('Look', { LookRight: once((m) => m.anchor.x < cx(m)) }),
  ]);

  const faceMouse = [];
  for (let i = 0; i < 10; i++) {
    faceMouse.push(
      ref('SitAndLookAtMouse', { Duration: between(10, 10) }),
      ref('Look', { LookRight: once((m) => m.anchor.x < cx(m)) }),
    );
  }
  A.SitAndFaceMouse = seq(faceMouse);
  A.SitAndSpinHead  = seq([ref('SitAndSpinHeadAction')]);

  // ═══════════════════════════════════════════════════════════
  // PETFOLIO ADDITIONS
  // ═══════════════════════════════════════════════════════════

  // What the mascot does when auto-pilot is off.
  A.Idle        = seq([ref('Stand')]);
  A.HoldWall    = seq([ref('GrabWall')]);
  A.HoldCeiling = seq([ref('GrabCeiling')]);

  // Border-less walk used for exit / enter (the floor check would otherwise
  // throw as soon as the anchor leaves the viewport).
  A.WalkOffscreen = move(null, [anim(strides(2, 3, -2, 6))]);

  // Emotes ----------------------------------------------------
  A.WalkHi = move('Floor', [anim([w(34, -2, 0, 6), w(35, -2, 0, 6), w(34, -2, 0, 6), w(36, -2, 0, 6)])]);
  A.SayHi = seq([
    ref('Say', { Text: 'Hi there! 👋' }),
    ref('WalkHi', { TargetX: acrossArea() }),
    ref('Stand', { Duration: between(40, 40) }),
  ]);

  A.TvCloneAnim = animate('Floor', [anim([38, 39, 40, 41, 40, 39, 1].map((i) => w(i, 0, 0, 10)))]);
  A.TvClone = seq([ref('TvCloneAnim'), ref('Stand', { Duration: between(20, 30) })]);

  A.RemoveCapAnim = animate('Floor', [anim([11, 15, 16, 17, 16, 1].map((i) => w(i, 0, 0, 10)))]);
  A.RemoveCap = seq([ref('RemoveCapAnim'), ref('Stand', { Duration: between(20, 30) })]);

  // Entrance: drop in from above the viewport.
  A.Summon = seq([
    ref('Place', {
      X: once((m) => area(m).left + area(m).width / 2),
      Y: once((m) => area(m).top - 200),
    }),
    ref('Fall'),
  ]);

  // Exit / peek / enter ---------------------------------------
  const exitTo = (right) => seq([
    ref('WalkOffscreen', {
      TargetX: once((m) => (right ? area(m).right + o.exitOffscreen : area(m).left - o.exitOffscreen)),
    }),
  ]);
  A.ExitLeft  = exitTo(false);
  A.ExitRight = exitTo(true);

  A.PeekPose = stay(null, [anim([w(20, 0, 0, 21), w(21, 0, 0, 21)])]);
  // Anchor is bottom-centre. Push it past the edge and below the viewport
  // bottom so only PEEK_INSET_H × PEEK_INSET_V px of the sprite stays visible.
  const peekSize = (m) => 128 * m.scaling;
  A.PeekLeft = seq([
    ref('Place', {
      X: once((m) => o.peekInsetH - peekSize(m) / 2),
      Y: once((m) => area(m).bottom + (peekSize(m) - o.peekInsetV)),
    }),
    ref('Look', { LookRight: true }),
    ref('PeekPose'),
  ]);
  A.PeekRight = seq([
    ref('Place', {
      X: once((m) => area(m).right - o.peekInsetH + peekSize(m) / 2),
      Y: once((m) => area(m).bottom + (peekSize(m) - o.peekInsetV)),
    }),
    ref('Look', { LookRight: false }),
    ref('PeekPose'),
  ]);

  const enterFrom = (right) => seq([
    ref('Place', {
      X: once((m) => (right ? area(m).right + 64 : area(m).left - 64)),
      Y: once((m) => area(m).bottom),
    }),
    ref('WalkOffscreen', {
      TargetX: once((m) => (right
        ? area(m).right - 120 - rnd() * 200
        : area(m).left + 120 + rnd() * 200)),
    }),
  ]);
  A.EnterLeft  = enterFrom(false);
  A.EnterRight = enterFrom(true);

  // ═══════════════════════════════════════════════════════════
  // BEHAVIOURS (conf/behaviors.xml)
  // ═══════════════════════════════════════════════════════════
  const onWall     = (m) => m.env.wall.isOn(m.anchor);
  const onCeiling  = (m) => m.env.ceiling.isOn(m.anchor);
  const floorArea  = (m) => area(m).bottomBorder.isOn(m.anchor);
  const facingWall = (m) => (m.lookRight
    ? area(m).rightBorder.isOn(m.anchor)
    : area(m).leftBorder.isOn(m.anchor));

  const B = (name, frequency, opts) => new BehaviorBuilder(name, frequency, opts);
  const next = (add, ...refs) => ({
    add,
    refs: refs.map(([name, frequency, condition]) => ({ name, frequency, condition })),
  });

  const behaviors = [
    // Always required ---------------------------------------
    B('ChaseMouse',       0, { forceNext: true, next: next(false, ['SitAndFaceMouse', 1]) }),
    B('SitAndFaceMouse',  0, { forceNext: true, next: next(false, ['SitAndFaceMouse', 100], ['SitAndSpinHead', 1], ['SitWhileDanglingLegs', 1]) }),
    B('SitAndSpinHead',   0, { forceNext: true, next: next(false, ['SitAndFaceMouse', 1]) }),
    B('Fall',    0),
    B('Dragged', 0),
    B('Thrown',  0),

    // On the floor ------------------------------------------
    B('StandUp', 200, { conditions: [onFloor] }),
    B('SitDown', 200, {
      conditions: [onFloor],
      next: next(true, ['SitWhileDanglingLegs', 100], ['LieDown', 100]),
    }),
    B('SitWhileDanglingLegs', 0, { conditions: [onFloor] }),
    B('LieDown', 0, {
      conditions: [onFloor],
      next: next(false, ['SitDown', 100], ['CrawlAlongWorkAreaFloor', 100, floorArea]),
    }),

    // On a wall ---------------------------------------------
    B('HoldOntoWall', 100, { conditions: [onWall] }),
    B('FallFromWall',  50, { conditions: [onWall, (m) => !onFloor(m)] }),

    // On the ceiling ----------------------------------------
    B('HoldOntoCeiling', 100, { conditions: [onCeiling] }),
    B('FallFromCeiling',  50, { conditions: [onCeiling] }),

    // On the work-area floor --------------------------------
    B('WalkAlongWorkAreaFloor', 100, { conditions: [floorArea] }),
    B('RunAlongWorkAreaFloor',  100, { conditions: [floorArea] }),
    B('CrawlAlongWorkAreaFloor', 10, {
      conditions: [floorArea],
      next: next(false, ['LieDown', 1]),
    }),
    B('WalkLeftAlongFloorAndSit',  100, { conditions: [floorArea] }),
    B('WalkRightAlongFloorAndSit', 100, { conditions: [floorArea] }),
    B('GrabWorkAreaBottomLeftWall',  100, { conditions: [floorArea] }),
    B('GrabWorkAreaBottomRightWall', 100, { conditions: [floorArea] }),
    B('WalkLeftAndSit',  100, { conditions: [floorArea] }),
    B('WalkRightAndSit', 100, { conditions: [floorArea] }),
    B('RunAndGrabBottomLeftWall',  100, { conditions: [floorArea] }),
    B('RunAndGrabBottomRightWall', 100, { conditions: [floorArea] }),

    // On a work-area wall (the one it is facing) ------------
    B('ClimbHalfwayAlongWall', 100, { conditions: [facingWall] }),
    B('ClimbAlongWall',        100, { conditions: [facingWall] }),

    // On the work-area ceiling ------------------------------
    B('ClimbAlongCeiling', 100, { conditions: [(m) => area(m).topBorder.isOn(m.anchor)] }),

    // Jump onto a wall when standing near it ----------------
    B('JumpFromLeftWall', 50, {
      conditions: [(m) => !area(m).leftBorder.isOn(m.anchor)
        && m.anchor.x < area(m).left + 400
        && Math.abs(area(m).bottom - m.anchor.y) < area(m).height / 4],
    }),
    B('JumpFromRightWall', 50, {
      conditions: [(m) => !area(m).rightBorder.isOn(m.anchor)
        && m.anchor.x >= area(m).right - 400
        && Math.abs(area(m).bottom - m.anchor.y) < area(m).height / 4],
    }),

    // Petfolio emotes — occasional extras on the floor -------
    B('SayHi',     40, { conditions: [floorArea] }),
    B('TvClone',   20, { conditions: [floorArea] }),
    B('RemoveCap', 30, {
      conditions: [floorArea],
      next: next(true, ['SitDown', 100]),
    }),

    // Petfolio: hold / manual / exit (never picked automatically) ----
    B('Idle', 0), B('HoldWall', 0), B('HoldCeiling', 0),
        B('Summon', 0),
    B('ExitLeft',  0, { allowOffscreen: true, forceNext: true, next: next(false, ['PeekLeft',  1]) }),
    B('ExitRight', 0, { allowOffscreen: true, forceNext: true, next: next(false, ['PeekRight', 1]) }),
    B('PeekLeft',  0, { allowOffscreen: true }),
    B('PeekRight', 0, { allowOffscreen: true }),
    B('EnterLeft',  0, { allowOffscreen: true }),
    B('EnterRight', 0, { allowOffscreen: true }),
  ];

  return new Configuration(A, behaviors);
}

/**
 * Short names kept from earlier Petfolio versions → the Shimeji behaviour
 * that implements them. Any behaviour name is
 * also accepted directly by pet.changeState().
 */
export const STATE_ALIASES = {
  idle:             'Idle',
  sit:              'SitDown',
  say_hi:           'SayHi',
  tv_clone:         'TvClone',
  remove_cap:       'RemoveCap',
  summon:           'Summon',
  'walk-off-left':  'ExitLeft',
  'walk-off-right': 'ExitRight',
};
