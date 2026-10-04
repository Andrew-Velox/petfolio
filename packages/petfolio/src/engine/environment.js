/**
 * engine/environment.js — The world the mascot lives in.
 *
 * Port of Shimeji's Environment / Area / Border / Location classes,
 * reduced to what a web page needs: ONE work area (the viewport) with a
 * floor (bottom edge), a ceiling (top edge) and two walls (left/right).
 *
 * Optional LEDGES (page mode): the top edges of page elements, handed in by the
 * host as a collision map (see platforms.js). A ledge is a one-way floor: the mascot
 * lands on it from above, may jump or fall through it from below, and is carried
 * along when the page scrolls under it. Without ledges nothing below changes.
 *
 * Shimeji rules we keep exactly:
 *   - the mascot has an integer "anchor" point; it is "on" a border only
 *     when the anchor lies EXACTLY on that border line (y === floor.y …)
 *   - a floor/ceiling only counts while left <= x <= right, a wall only
 *     while top <= y <= bottom
 *   - actions fix their border at init time; if the anchor ever leaves it,
 *     the action throws LostGroundError and the mascot falls
 */

/** A border the mascot is not standing on. isOn() is always false. */
export const NOT_ON_BORDER = Object.freeze({ isOn: () => false });

export class LostGroundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LostGroundError';
  }
}

/** Lowest a ledge may sit and still be used: higher up the pet's head would be cut off by the viewport. */
export const LEDGE_MIN_Y = 100;
/** Ledges this close to the real floor are not worth a separate surface. */
const LEDGE_FLOOR_GAP = 24;

class FloorCeiling {
  constructor(area, bottom) { this.area = area; this.bottom = bottom; }
  get y() { return this.bottom ? this.area.bottom : this.area.top; }
  get left()  { return this.area.left; }
  get right() { return this.area.right; }
  isOn(p) {
    return p.y === this.y && this.area.left <= p.x && p.x <= this.area.right;
  }
}

class Wall {
  constructor(area, right) { this.area = area; this.right = right; }
  get x() { return this.right ? this.area.right : this.area.left; }
  isOn(p) {
    return p.x === this.x && this.area.top <= p.y && p.y <= this.area.bottom;
  }
}

/** A one-way floor made from the top edge of a page element (viewport coordinates, updated by Environment). */
export class Ledge {
  constructor(id) {
    this.id = id;
    this.y = 0; this.left = 0; this.right = 0;
    this.fixed = false;   // position: fixed → does not move when the page scrolls
    this.gone = false;    // removed from the map: any action still holding it must lose its footing
  }
  isOn(p) {
    return !this.gone && p.y === this.y && this.left <= p.x && p.x <= this.right;
  }
}

export class Area {
  constructor() {
    this.left = 0; this.top = 0; this.right = 0; this.bottom = 0;
    this.topBorder    = new FloorCeiling(this, false);
    this.bottomBorder = new FloorCeiling(this, true);
    this.leftBorder   = new Wall(this, false);
    this.rightBorder  = new Wall(this, true);
  }
  get width()  { return this.right - this.left; }
  get height() { return this.bottom - this.top; }
  set(l, t, r, b) { this.left = l; this.top = t; this.right = r; this.bottom = b; }
}

/**
 * Pointer position plus per-tick velocity (Shimeji's Location with dx/dy).
 * dx/dy feed the Thrown behaviour, so we smooth them over the last few
 * ticks instead of using one raw 40 ms delta (which is very noisy in a
 * browser, where pointer events don't arrive on a fixed clock).
 */
const CURSOR_HISTORY = 3;
const CURSOR_MAX_SPEED = 40; // px/tick, keeps a wild flick from yeeting the mascot

export class Cursor {
  constructor() {
    this.x = 0; this.y = 0;
    this.dx = 0; this.dy = 0;
    this._rawX = 0; this._rawY = 0;
    this._history = [];
  }
  /** Called from pointer events (any time between ticks). */
  moveTo(x, y) { this._rawX = x; this._rawY = y; }
  /** Jump straight to a position with no velocity (pointer just went down). */
  snapTo(x, y) {
    this._rawX = x; this._rawY = y;
    this.x = Math.round(x); this.y = Math.round(y);
    this.dx = 0; this.dy = 0;
    this._history = [{ x: this.x, y: this.y }];
  }
  /** Called once per engine tick. */
  tick() {
    this.x = Math.round(this._rawX);
    this.y = Math.round(this._rawY);
    const h = this._history;
    h.push({ x: this.x, y: this.y });
    if (h.length > CURSOR_HISTORY + 1) h.shift();
    const n = h.length - 1;
    if (n > 0) {
      const clamp = (v) => Math.max(-CURSOR_MAX_SPEED, Math.min(CURSOR_MAX_SPEED, v));
      this.dx = clamp((this.x - h[0].x) / n);
      this.dy = clamp((this.y - h[0].y) / n);
    } else {
      this.dx = 0; this.dy = 0;
    }
  }
}

export class Environment {
  /**
   * @param {() => {width:number, height:number}} getSize  viewport size provider
   * @param {() => {x:number, y:number}} [getScroll]       page scroll offset (only needed for ledges)
   */
  constructor(getSize, getScroll = null) {
    this.getSize    = getSize;
    this.getScroll  = getScroll;
    this.workArea   = new Area();
    this.screen     = this.workArea;   // single-screen: same rectangle
    this.cursor     = new Cursor();
    this.mascot     = null;            // set by Mascot
    this.cornerMode = false;           // true → the pet parks in a corner instead of roaming (see Configuration.isAllowed)

    // Ledges (page mode) — empty means plain floor-only physics.
    this.platforms  = [];              // the collision map, page coordinates (platforms.js)
    this.ledges     = new Map();       // id → Ledge, viewport coordinates, refreshed every tick
    this._landable  = [];              // the ledges the mascot may use right now
    this.scroll     = { x: 0, y: 0 };  // scroll offset the ledges were last laid out with
    this.dropFrom   = null;            // ledge the mascot is deliberately falling through
    this.carried    = false;           // last tick: the mascot rode a scrolling ledge
    this.carry      = { x: 0, y: 0 };  // …by this much

    this.tick();
  }

  /** Replace the collision map (page coordinates, see platforms.js). `[]` = floor-only physics. */
  setPlatforms(platforms) {
    this.platforms = platforms;
    this._layoutLedges();
  }

  /** Mirrors AbstractEnvironment.tick(): refresh geometry + cursor. */
  tick() {
    const { width, height } = this.getSize();
    this.workArea.set(0, 0, Math.round(width), Math.round(height));
    this.cursor.tick();
    if (this.platforms.length || this.ledges.size) this._layoutLedges();
  }

  // The *current* border, re-evaluated against the mascot's anchor every call
  // (Fall mutates the anchor while sweeping and re-queries the environment).
  get floor() {
    const bottom = this._on(this.workArea.bottomBorder);
    return bottom !== NOT_ON_BORDER ? bottom : (this.ledge ?? NOT_ON_BORDER);
  }
  get ceiling() { return this._on(this.workArea.topBorder); }
  get wall() {
    const a = this.workArea;
    if (a.leftBorder.isOn(this.mascot.anchor))  return a.leftBorder;
    if (a.rightBorder.isOn(this.mascot.anchor)) return a.rightBorder;
    return NOT_ON_BORDER;
  }

  /** The ledge the mascot stands on, or null (also null on the real floor). */
  get ledge() {
    const m = this.mascot;
    if (!m) return null;
    for (const l of this._landable) if (l.isOn(m.anchor)) return l;
    return null;
  }

  _on(border) {
    return this.mascot && border.isOn(this.mascot.anchor) ? border : NOT_ON_BORDER;
  }

  // ── Ledges ────────────────────────────────────────────────
  /**
   * Fall's landing test: is there a ledge top at exactly (x, y)? One-way — only a
   * mascot that started this tick at or above the ledge (`fromY <= ledge.y`) lands.
   * Fall moves in steps of at most 1 px, so an exact match cannot be skipped over.
   */
  ledgeLanding(x, y, fromY) {
    for (const l of this._landable) {
      if (l.y === y && fromY <= y && l.left <= x && x <= l.right && l !== this.dropFrom) return l;
    }
    return null;
  }

  /** Let go of `ledge` and fall through it (a ledge that spans the whole width has no edge to step off). */
  dropThrough(ledge) { this.dropFrom = ledge; }

  /** Part of the current ledge that is on screen and not right at a wall: where the mascot may walk. */
  ledgeSpan(margin = 24) {
    const l = this.ledge;
    const a = this.workArea;
    if (!l) return null;
    const lo = Math.max(l.left, a.left) + margin;
    const hi = Math.min(l.right, a.right) - margin;
    return lo < hi ? { lo, hi } : null;
  }

  /**
   * An edge of the current ledge the mascot can walk off, clear of the walls, nearest first.
   * @returns {{x:number, dir:-1|1}|null}  null → no usable edge (use dropThrough)
   */
  ledgeExit(margin = 40) {
    const l = this.ledge;
    const a = this.workArea;
    const m = this.mascot;
    if (!l || !m) return null;
    const left  = l.left  > a.left  + margin ? { x: l.left,  dir: -1 } : null;
    const right = l.right < a.right - margin ? { x: l.right, dir:  1 } : null;
    if (left && right) return m.anchor.x - l.left <= l.right - m.anchor.x ? left : right;
    return left ?? right;
  }

  /**
   * A ledge above that the mascot can jump to from where it stands: the nearest one that
   * is 40–`maxRise` px higher (default: 60 % of the viewport height, at least 300) and within `maxRun` px sideways. The landing spot is always
   * inside the visible part of the ledge.
   * @returns {{x:number, y:number, ledge:Ledge}|null}
   */
  jumpTarget(maxRise = Math.max(300, Math.round(this.workArea.height * 0.6)), maxRun = 280) {
    const m = this.mascot;
    if (!m) return null;
    const a = m.anchor;
    const area = this.workArea;
    const here = this.ledge;
    let best = null;
    let bestScore = Infinity;
    for (const l of this._landable) {
      if (l === here) continue;
      const rise = a.y - l.y;
      if (rise < 40 || rise > maxRise) continue;
      const lo = Math.max(l.left + 24, area.left + 64);
      const hi = Math.min(l.right - 24, area.right - 64);
      if (lo > hi) continue;
      const x = Math.min(hi, Math.max(lo, a.x));
      const run = Math.abs(x - a.x);
      if (run > maxRun) continue;
      if (run + rise < bestScore) { best = { x, y: l.y, ledge: l }; bestScore = run + rise; }
    }
    return best;
  }

  /**
   * How far the page has scrolled since the last tick, as a screen offset. The host adds it to
   * the drawn position of a mascot riding a ledge, so the pet follows the scroll every frame
   * instead of in 40 ms steps.
   */
  renderShift() {
    if (!this.carried || !this.getScroll) return { x: 0, y: 0 };
    const now = this.getScroll();
    return { x: this.scroll.x - Math.round(now.x), y: this.scroll.y - Math.round(now.y) };
  }

  /** Page coordinates → viewport coordinates for this tick; carry the mascot with its ledge. */
  _layoutLedges() {
    const m = this.mascot;
    const area = this.workArea;
    const riding = m && !m.dragging ? this.ledge : null;
    const from = riding ? { x: riding.left, y: riding.y } : null;

    const s = this.getScroll ? this.getScroll() : { x: 0, y: 0 };
    this.scroll = { x: Math.round(s.x), y: Math.round(s.y) };

    const next = new Map();
    for (const p of this.platforms) {
      const l = this.ledges.get(p.id) ?? new Ledge(p.id);
      l.gone  = false;
      l.fixed = p.fixed;
      const sx = p.fixed ? 0 : this.scroll.x;
      const sy = p.fixed ? 0 : this.scroll.y;
      l.y     = Math.round(p.top - sy);
      l.left  = Math.round(p.left - sx);
      l.right = Math.round(p.right - sx);
      next.set(p.id, l);
    }
    for (const [id, l] of this.ledges) if (!next.has(id)) l.gone = true;
    this.ledges = next;

    this._landable = [];
    for (const l of next.values()) {
      if (l.y >= LEDGE_MIN_Y && l.y <= area.bottom - LEDGE_FLOOR_GAP && l.right > area.left && l.left < area.right) {
        this._landable.push(l);
      }
    }

    // Carry: the ledge moved (scroll, layout shift) → the mascot goes with it, as long as the
    // ledge is still somewhere it can use. Otherwise it is left behind and simply falls.
    this.carried = false;
    this.carry = { x: 0, y: 0 };
    if (riding && next.get(riding.id) === riding && this._landable.includes(riding)) {
      const dx = riding.left - from.x;
      const dy = riding.y - from.y;
      if (dx || dy) {
        m.anchor.x += dx;
        m.anchor.y += dy;
        this.carry = { x: dx, y: dy };
      }
      this.carried = !riding.fixed;
    }

    if (this.dropFrom && (this.dropFrom.gone || !m || m.dragging || m.anchor.y > this.dropFrom.y + 12)) {
      this.dropFrom = null;
    }
  }
}
