/**
 * engine/physics-mode.js — Which physics the pet should use right now.
 *
 * The page owner asks for a mode (`physics` option); this decides what actually runs:
 *
 *   'floor'   the window edges only (the classic behaviour, and the safe one)
 *   'page'    the window edges plus the page's elements as ledges (collision map)
 *   'corner'  the pet parks in the bottom corner and idles; it does not roam
 *
 * 'page' falls back to 'floor' by itself whenever the page is a bad fit, so a messy
 * layout can never leave the pet in a strange place:
 *   - the user prefers reduced motion, the device is touch-only, or the viewport is narrow
 *   - the page offers too few stable surfaces
 *   - the map keeps changing (animated or lazy-loading layout), or the pet keeps losing its
 *     footing: both mean the ledges are not stable enough to stand on. 'floor' then lasts
 *     for a cool-down, after which 'page' gets another chance.
 *
 * Pure (time is passed in), so it runs under Node for tests.
 */

export const PHYSICS_MODES = ['floor', 'page', 'corner'];

export const NARROW_VIEWPORT = 600;    // px; narrower = phone-sized, the pet roams the floor only
export const MIN_PLATFORMS   = 3;      // fewer usable surfaces than this → not worth it
export const CHURN_LIMIT     = 5;      // map changes…
export const CHURN_WINDOW_MS = 12_000; // …within this window = unstable layout
export const FALL_LIMIT      = 5;      // times the pet lost its footing…
export const FALL_WINDOW_MS  = 12_000; // …within this window = unstable ledges
export const COOLDOWN_MS     = 30_000; // how long 'floor' is used after an instability

/** Unknown / missing → 'floor'. */
export function normalizeMode(value) {
  return PHYSICS_MODES.includes(value) ? value : 'floor';
}

export class PhysicsGovernor {
  /** @param {'floor'|'page'|'corner'} requested */
  constructor(requested) {
    this.requested = normalizeMode(requested);
    this._changes = [];       // timestamps of map changes
    this._falls = [];         // timestamps of lost footing
    this._cooldownUntil = 0;
    this._last = null;        // what evaluate() answered last time
  }

  /** The page owner changed the requested mode. */
  request(mode) {
    this.requested = normalizeMode(mode);
    this._changes = []; this._falls = []; this._cooldownUntil = 0; this._last = null;
  }

  /** @param {'change'|'fall'} kind  @param {number} now ms */
  note(kind, now) {
    (kind === 'fall' ? this._falls : this._changes).push(now);
  }

  /**
   * @param {{width:number, touchOnly?:boolean, reducedMotion?:boolean, platformCount:number}} ctx
   * @param {number} now ms
   * @returns {{mode:'floor'|'page'|'corner', reason:string|null}}  reason = why 'page' was not used
   */
  evaluate(ctx, now) {
    if (this.requested !== 'page') return { mode: this.requested, reason: null };

    if (ctx.reducedMotion)             return { mode: 'floor', reason: 'reduced-motion' };
    if (ctx.touchOnly)                 return { mode: 'floor', reason: 'touch-only' };
    if (ctx.width < NARROW_VIEWPORT)   return { mode: 'floor', reason: 'narrow-viewport' };

    if (now < this._cooldownUntil)     return { mode: 'floor', reason: 'unstable' };
    this._changes = this._changes.filter((t) => now - t <= CHURN_WINDOW_MS);
    this._falls   = this._falls.filter((t) => now - t <= FALL_WINDOW_MS);
    if (this._changes.length >= CHURN_LIMIT || this._falls.length >= FALL_LIMIT) {
      this._cooldownUntil = now + COOLDOWN_MS;
      this._changes = []; this._falls = [];
      return { mode: 'floor', reason: 'unstable' };
    }

    if (ctx.platformCount < MIN_PLATFORMS) {
      // A page that had enough surfaces a moment ago and has none now is flapping, not just bare:
      // count the flip, so a layout that keeps toggling ends up in the 'unstable' cool-down.
      if (this._last === 'page') this._changes.push(now);
      this._last = 'floor';
      return { mode: 'floor', reason: 'few-platforms' };
    }
    this._last = 'page';
    return { mode: 'page', reason: null };
  }
}
