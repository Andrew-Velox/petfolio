/**
 * engine/actions.js — Shimeji's action classes, ported to JS.
 *
 * An Action is something the mascot does for a while: Stay, Move, Animate,
 * Jump, Fall, Dragged … Leaf actions drive an Animation; composite actions
 * (Sequence, Select) run other actions. Every action follows the same
 * life-cycle (ActionBase):
 *
 *     init(mascot)   start; elapsed time = 0
 *     hasNext()      still running?  (time < Duration && Condition holds …)
 *     next()         advance one 40 ms tick
 *
 * Behaviour (behavior.js) wraps one top-level action and, once it stops
 * running, picks the next behaviour.
 *
 * ── Parameters ─────────────────────────────────────────────
 * Shimeji actions take attributes such as TargetX or Duration. They can be
 * constants or scripts, and scripts come in two flavours:
 *     ${ … }  evaluated ONCE per action instance, then cached
 *     #{ … } re-evaluated EVERY tick
 * Here that is `once(fn)` and `dyn(fn)`; both receive (mascot, action).
 * (We use closures instead of eval'ing strings so the library works under
 * strict Content-Security-Policy pages.)
 */
import { LostGroundError } from './environment.js';

// ── Parameters ───────────────────────────────────────────────

const PARAM = Symbol('param');

/** `${…}` — evaluated on first use, then cached for the action's lifetime. */
export const once = (fn) => ({ [PARAM]: true, once: true, fn });
/** `#{…}` — re-evaluated every time it is read. */
export const dyn  = (fn) => ({ [PARAM]: true, once: false, fn });

const isParam = (v) => v !== null && typeof v === 'object' && v[PARAM] === true;

// ── ActionBase ───────────────────────────────────────────────

export class ActionBase {
  constructor(spec, params) {
    this.spec       = spec;
    this.params     = params;
    this.animations = spec.animations ?? [];
    this.mascot     = null;
    this.startTime  = 0;
    this.vars       = {};   // runtime variables set by the action (FootX, VelocityX …)
    this._cache     = {};   // cached `once` values
  }

  get name() { return this.spec.name ?? this.spec.kind; }

  init(mascot) {
    this.mascot = mascot;
    this._cache = {};
    this.vars   = {};
    this.setTime(0);
  }

  get time() { return this.mascot.time - this.startTime; }
  setTime(t) { this.startTime = this.mascot.time - t; }

  /** Read a parameter or runtime variable. */
  v(name, fallback) {
    if (name in this.vars) return this.vars[name];
    const p = this.params[name];
    if (p === undefined) return fallback;
    if (!isParam(p)) return p;
    if (!p.once) return p.fn(this.mascot, this);
    if (!(name in this._cache)) this._cache[name] = p.fn(this.mascot, this);
    return this._cache[name];
  }

  /** Integer parameter (Java's Number.intValue() truncates toward zero). */
  int(name, fallback) {
    const raw = this.v(name, undefined);
    if (raw === undefined) return fallback;
    const n = Math.trunc(Number(raw));
    return Number.isNaN(n) ? 0 : n;
  }

  get duration()  { return this.v('Duration', Infinity); }
  isEffective()   { return this.v('Condition', true); }
  isDraggable()   { return this.v('Draggable', true); }

  hasNext() {
    return this.mascot !== null && this.time < this.duration && this.isEffective();
  }

  next() { this.tick(); }
  tick() {}

  /** First animation whose condition holds (null if none). */
  getAnimation() {
    for (const a of this.animations) {
      if (a.isEffective(this.mascot, this)) return a;
    }
    return null;
  }
}

// ── Bordered actions (Stay / Move / Animate) ─────────────────

class BorderedAction extends ActionBase {
  init(mascot) {
    super.init(mascot);
    // The border is fixed at init time — the one the mascot is standing on
    // *right now*. If it is not on that kind of border at all, we get
    // NOT_ON_BORDER and the first tick throws LostGroundError (→ Fall).
    switch (this.spec.border) {
      case 'Floor':   this.border = mascot.env.floor;   break;
      case 'Ceiling': this.border = mascot.env.ceiling; break;
      case 'Wall':    this.border = mascot.env.wall;    break;
      default:        this.border = null;
    }
  }

  checkBorder() {
    if (this.border && !this.border.isOn(this.mascot.anchor)) {
      throw new LostGroundError('Mascot is not on border');
    }
  }
}

/** Stand still on a border, showing the animation. */
export class Stay extends BorderedAction {
  tick() {
    this.checkBorder();
    this.getAnimation().apply(this.mascot, this.time);
  }
}

/** Play the animation once, then stop. */
export class Animate extends BorderedAction {
  hasNext() {
    return super.hasNext() && this.time < this.getAnimation().duration;
  }
  tick() {
    this.checkBorder();
    this.getAnimation().apply(this.mascot, this.time);
  }
}

/** Move toward TargetX / TargetY using the velocities inside the poses. */
export class Move extends BorderedAction {
  hasNext() {
    if (!super.hasNext()) return false;
    const tx = this.int('TargetX', null);
    const ty = this.int('TargetY', null);
    const a  = this.mascot.anchor;
    return (tx !== null && a.x !== tx) || (ty !== null && a.y !== ty);
  }

  tick() {
    this.checkBorder();
    const m  = this.mascot;
    const tx = this.int('TargetX', null);
    const ty = this.int('TargetY', null);

    if (tx !== null && m.anchor.x !== tx) m.lookRight = m.anchor.x < tx;
    const down = ty !== null ? m.anchor.y < ty : false;

    this.getAnimation().apply(m, this.time);

    // Never overshoot the target.
    if (tx !== null) {
      if ((m.lookRight && m.anchor.x >= tx) || (!m.lookRight && m.anchor.x <= tx)) m.anchor.x = tx;
    }
    if (ty !== null) {
      if ((down && m.anchor.y >= ty) || (!down && m.anchor.y <= ty)) m.anchor.y = ty;
    }
  }
}

// ── Jump ─────────────────────────────────────────────────────

/**
 * Fly toward (TargetX, TargetY) at VelocityParam px/tick.
 *
 * The aim point is raised by half the remaining horizontal distance:
 *     distanceY = targetY - y - |distanceX| / 2
 * so the mascot launches steeply and flattens out as it closes in — a
 * cheap, very readable arc. This is exactly how Shimeji jumps to walls.
 */
export class Jump extends ActionBase {
  geometry() {
    const a  = this.mascot.anchor;
    const tx = this.int('TargetX', 0);
    const ty = this.int('TargetY', 0);
    const distanceX = tx - a.x;
    const distanceY = ty - a.y - Math.abs(distanceX) / 2;
    return { tx, ty, distanceX, distanceY, distance: Math.hypot(distanceX, distanceY) };
  }

  hasNext() {
    return super.hasNext() && this.geometry().distance !== 0;
  }

  tick() {
    const m = this.mascot;
    const { tx, ty, distanceX, distanceY, distance } = this.geometry();

    if (m.anchor.x !== tx) m.lookRight = m.anchor.x < tx;

    const velocity = this.v('VelocityParam', 20) * m.scaling;
    if (distance !== 0) {
      const vx = velocity * distanceX / distance;
      const vy = velocity * distanceY / distance;
      this.vars.VelocityX = vx;
      this.vars.VelocityY = vy;
      m.anchor.x += Math.round(vx);
      m.anchor.y += Math.round(vy);
      this.getAnimation().apply(m, this.time);
    }
    if (distance <= velocity) {
      m.anchor.x = tx;
      m.anchor.y = ty;
    }
  }
}

// ── Fall ─────────────────────────────────────────────────────

/**
 * Ballistic motion: gravity + air resistance, with Shimeji's sweep that
 * stops the mascot exactly on the floor (checked up to 80 px above the
 * landing point so it never tunnels through) or exactly on a wall.
 * Also used for being thrown — pass InitialVX / InitialVY.
 */
export class Fall extends ActionBase {
  init(mascot) {
    super.init(mascot);
    this.scaling   = mascot.scaling;
    this.velocityX = this.v('InitialVX', 0) * this.scaling;
    this.velocityY = this.v('InitialVY', 0) * this.scaling;
    this.modX = 0;
    this.modY = 0;
  }

  hasNext() {
    if (!super.hasNext()) return false;
    const env = this.mascot.env;
    const a   = this.mascot.anchor;
    // Upward velocity is allowed to start from the floor (jump-off / throw
    // up); otherwise stop as soon as we touch floor or wall.
    return (this.velocityY < 0 || !env.floor.isOn(a)) && !env.wall.isOn(a);
  }

  tick() {
    const m   = this.mascot;
    const env = m.env;

    if (this.velocityX !== 0) m.lookRight = this.velocityX > 0;

    const resX    = this.v('ResistanceX', 0.05);
    const resY    = this.v('ResistanceY', 0.1);
    const gravity = this.v('Gravity', 2);

    this.velocityX = this.velocityX - this.velocityX * resX;
    this.velocityY = this.velocityY - this.velocityY * resY + gravity * this.scaling;
    this.vars.VelocityX = this.velocityX;
    this.vars.VelocityY = this.velocityY;

    // Carry sub-pixel remainders so slow speeds still accumulate.
    this.modX += this.velocityX % 1;
    this.modY += this.velocityY % 1;
    const dx = Math.round(this.velocityX + this.modX);
    const dy = Math.round(this.velocityY + this.modY);
    this.modX %= 1;
    this.modY %= 1;

    const dev     = Math.max(1, Math.abs(dx), Math.abs(dy));
    const startX  = m.anchor.x;
    const startY  = m.anchor.y;
    const a       = m.anchor;

    // Walk the path in ≤1 px steps so we can't skip over a wall or floor.
    const bottom = env.workArea.bottomBorder;
    outer:
    for (let i = 0; i <= dev; i++) {
      const x = startX + Math.trunc(dx * i / dev);
      const y = startY + Math.trunc(dy * i / dev);
      if (dy > 0) {
        for (let j = -80; j <= 0; j++) {
          a.x = x; a.y = y + j;
          if (bottom.isOn(a)) break outer;
        }
        // Page ledges are one-way floors: only the exact line counts (no 80 px look-back, which
        // would pull a mascot that is below a ledge up onto it).
        const ledge = env.ledgeLanding(x, y, startY);
        if (ledge) { a.x = x; a.y = ledge.y; break; }
      } else {
        a.x = x; a.y = y;
      }
      if (env.wall.isOn(a)) break;
    }

    this.getAnimation().apply(m, this.time);
  }
}

// ── Dragging ─────────────────────────────────────────────────

const DRAG_OFFSET_Y   = 120;  // mascot hangs by the head: foot is 120 px below the cursor
const DRAG_RESIST_TIME = 250; // ticks of holding still before it starts to struggle

/** The mascot is being held by the pointer. */
export class Dragged extends ActionBase {
  init(mascot) {
    super.init(mascot);
    this.scaling = mascot.scaling;
    this.footX   = mascot.env.cursor.x + Math.round(this.v('OffsetX', 0) * this.scaling);
    this.footDx  = 0;
    this.timeToResist = DRAG_RESIST_TIME;
  }

  hasNext() {
    return super.hasNext() && this.time < this.timeToResist;
  }

  tick() {
    const m      = this.mascot;
    const cursor = m.env.cursor;
    const area   = m.env.workArea;

    m.lookRight = false;
    m.dragging  = true;

    const offsetX = Math.round(this.v('OffsetX', 0) * this.scaling);
    const offsetY = Math.round(this.v('OffsetY', DRAG_OFFSET_Y) * this.scaling);

    // Moving the cursor wakes the mascot up (restarts the "resist" timer).
    if (Math.abs(cursor.x + offsetX - m.anchor.x) >= 5) this.setTime(0);

    // FootX trails the cursor with a damped spring so the mascot sways
    // while dragged; the Pinched animation picks its pose from FootX-cursor.x.
    this.footDx = (this.footDx + (cursor.x - this.footX) * 0.1) * 0.8;
    this.footX += this.footDx;
    this.vars.FootDX = this.footDx;
    this.vars.FootX  = this.footX;

    this.getAnimation().apply(m, this.time);

    m.anchor.x = cursor.x + offsetX;
    // Web tweak: a desktop has room below the floor (taskbar), a page does
    // not — never hang the feet below the viewport bottom.
    m.anchor.y = Math.min(cursor.y + offsetY, area.bottom);

    // After a while the mascot may start resisting (see Regist). 90 % of the
    // time it just keeps being held for another tick.
    if (this.time === this.timeToResist - 1 && Math.random() >= 0.1) this.timeToResist++;
  }
}

/** The "let me go!" struggle after being held for a long time. */
export class Regist extends ActionBase {
  hasNext() {
    if (!super.hasNext()) return false;
    const m = this.mascot;
    const offsetX = Math.round(this.v('OffsetX', 0) * m.scaling);
    return Math.abs(m.env.cursor.x - m.anchor.x + offsetX) < 5;
  }

  tick() {
    const m = this.mascot;
    m.dragging = true;
    const animation = this.getAnimation();
    animation.apply(m, this.time);
    if (this.time + 1 >= animation.duration) {
      // Breaks free: pick a random facing, then Behavior drops it into Fall.
      m.lookRight = Math.random() < 0.5;
      throw new LostGroundError('Mascot finished Regist action');
    }
  }
}

// ── Instant actions ──────────────────────────────────────────

class InstantAction extends ActionBase {
  init(mascot) { super.init(mascot); this.done = false; }
  hasNext() { return super.hasNext() && !this.done; }
  tick() { this.apply(); this.done = true; }
}

/** Translate the anchor by (X, Y). */
export class Offset extends InstantAction {
  apply() {
    this.mascot.anchor.x += this.int('X', 0);
    this.mascot.anchor.y += this.int('Y', 0);
  }
}

/** Set facing. No LookRight → flip. */
export class Look extends InstantAction {
  apply() {
    this.mascot.lookRight = this.v('LookRight', !this.mascot.lookRight);
  }
}

/** Teleport the anchor to (X, Y). Petfolio addition (exit / peek / entrances). */
export class Place extends InstantAction {
  apply() {
    this.mascot.anchor.x = this.int('X', this.mascot.anchor.x);
    this.mascot.anchor.y = this.int('Y', this.mascot.anchor.y);
  }
}

/**
 * Step off the ledge the mascot stands on. At an edge it takes two steps past it; with no
 * edge to use (a ledge as wide as the page) it falls straight through, since ledges are
 * one-way. The Stand that follows then loses its footing and Behavior drops into Fall.
 * Petfolio addition.
 */
export class LedgeDrop extends InstantAction {
  apply() {
    const m = this.mascot;
    const env = m.env;
    const ledge = env.ledge;
    if (!ledge) return;
    const exit = env.ledgeExit();
    if (exit && Math.abs(m.anchor.x - exit.x) <= 1) {
      m.anchor.x = exit.x + exit.dir * 2;
    } else {
      env.dropThrough(ledge);
      m.anchor.y += 1;
    }
  }
}

/** Show a speech bubble. Petfolio addition. */
export class Say extends InstantAction {
  apply() {
    this.mascot.say(this.v('Text', ''));
  }
}

// ── Composite actions ────────────────────────────────────────

const MAX_SEEK = 1000; // guards against a looping sequence whose children are all finished

class ComplexAction extends ActionBase {
  constructor(spec, params, children) {
    super(spec, params);
    this.children = children;
    this.current  = 0;
  }

  init(mascot) {
    super.init(mascot);
    this.current = 0;
    if (super.hasNext()) {
      this.setCurrent(0);
      this.seek();
    }
  }

  get child() { return this.children[this.current]; }

  /** Skip over children that have nothing left to do. */
  seek() {
    if (!super.hasNext()) return;
    for (let guard = 0; this.current < this.children.length && guard < MAX_SEEK; guard++) {
      if (this.child.hasNext()) break;
      this.setCurrent(this.current + 1);
    }
  }

  hasNext() {
    return super.hasNext() && this.current < this.children.length && this.child.hasNext();
  }

  tick() {
    const c = this.child;
    if (c.hasNext()) c.next();
  }

  setCurrent(i) {
    this.current = i;
    if (super.hasNext() && this.current < this.children.length) {
      this.child.init(this.mascot);
    }
  }

  isDraggable() {
    const c = this.children[this.current];
    return c ? c.isDraggable() : true;
  }
}

/** Run children one after another (optionally looping). */
export class Sequence extends ComplexAction {
  hasNext() {
    this.seek();
    return super.hasNext();
  }
  setCurrent(i) {
    const n = this.children.length;
    super.setCurrent(this.v('Loop', false) && n > 0 ? i % n : i);
  }
}

/** Run the first child whose Condition holds; ends when it ends. */
export class Select extends ComplexAction {}

// ── Specs & factory ──────────────────────────────────────────
//
// Config files describe actions as plain data ("specs"); every time a
// behaviour is built the spec is instantiated into a fresh action tree
// (actions hold per-run state, so instances are never reused).

export const stay    = (border, animations, params = {}) => ({ kind: 'Stay',    border, animations, params });
export const move    = (border, animations, params = {}) => ({ kind: 'Move',    border, animations, params });
export const animate = (border, animations, params = {}) => ({ kind: 'Animate', border, animations, params });
export const jump    = (animations, params = {}) => ({ kind: 'Jump',     animations, params });
export const fall    = (animations, params = {}) => ({ kind: 'Fall',     animations, params });
export const dragged = (animations, params = {}) => ({ kind: 'Dragged',  animations, params });
export const regist  = (animations, params = {}) => ({ kind: 'Regist',   animations, params });
export const seq     = (children, params = {})   => ({ kind: 'Sequence', children, params });
export const select  = (children, params = {})   => ({ kind: 'Select',   children, params });
/** Reference a named action, overriding some of its parameters. */
export const ref     = (name, params = {})       => ({ kind: 'Ref', name, params });

const LEAVES = { Stay, Move, Animate, Jump, Fall, Dragged, Regist, Offset, Look, Place, Say, LedgeDrop };
const COMPOSITES = { Sequence, Select };

/**
 * Instantiate a spec.
 * @param {object} spec
 * @param {Record<string, object>} registry  name → spec
 * @param {object} [extra]  params coming from an enclosing `ref`
 */
export function buildAction(spec, registry, extra = {}) {
  if (spec.kind === 'Ref') {
    const target = registry[spec.name];
    if (!target) throw new Error(`Unknown action "${spec.name}"`);
    const built = buildAction(target, registry, { ...spec.params, ...extra });
    built.spec = { ...built.spec, name: spec.name };
    return built;
  }
  const params = { ...spec.params, ...extra };
  if (spec.kind in COMPOSITES) {
    const kids = spec.children.map((c) => buildAction(c, registry));
    return new COMPOSITES[spec.kind](spec, params, kids);
  }
  const Cls = LEAVES[spec.kind];
  if (!Cls) throw new Error(`Unknown action kind "${spec.kind}"`);
  return new Cls(spec, params);
}

