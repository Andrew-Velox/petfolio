/**
 * engine/environment.js — The world the mascot lives in.
 *
 * Port of Shimeji's Environment / Area / Border / Location classes,
 * reduced to what a web page needs: ONE work area (the viewport) with a
 * floor (bottom edge), a ceiling (top edge) and two walls (left/right).
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

class FloorCeiling {
  constructor(area, bottom) { this.area = area; this.bottom = bottom; }
  get y() { return this.bottom ? this.area.bottom : this.area.top; }
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
   */
  constructor(getSize) {
    this.getSize    = getSize;
    this.workArea   = new Area();
    this.screen     = this.workArea;   // single-screen: same rectangle
    this.cursor     = new Cursor();
    this.mascot     = null;            // set by Mascot
    this.tick();
  }

  /** Mirrors AbstractEnvironment.tick(): refresh geometry + cursor. */
  tick() {
    const { width, height } = this.getSize();
    this.workArea.set(0, 0, Math.round(width), Math.round(height));
    this.cursor.tick();
  }

  // The *current* border, re-evaluated against the mascot's anchor every call
  // (Fall mutates the anchor while sweeping and re-queries the environment).
  get floor()   { return this._on(this.workArea.bottomBorder); }
  get ceiling() { return this._on(this.workArea.topBorder); }
  get wall() {
    const a = this.workArea;
    if (a.leftBorder.isOn(this.mascot.anchor))  return a.leftBorder;
    if (a.rightBorder.isOn(this.mascot.anchor)) return a.rightBorder;
    return NOT_ON_BORDER;
  }

  _on(border) {
    return this.mascot && border.isOn(this.mascot.anchor) ? border : NOT_ON_BORDER;
  }
}
