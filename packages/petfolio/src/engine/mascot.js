/**
 * engine/mascot.js — The mascot: anchor point, facing, clock and behaviour.
 *
 * Port of Shimeji's Mascot. It owns no rendering; the host (Petfolio.js)
 * reads `anchor`, `lookRight` and `pose` after every tick and draws them.
 */
export class Mascot {
  /**
   * @param {import('./environment.js').Environment} env
   * @param {import('./behavior.js').Configuration}  config
   * @param {object} [opts]
   * @param {number} [opts.scaling=1]  sprite scale; Jump/Fall speeds follow it like Shimeji's "scaling"
   */
  constructor(env, config, opts = {}) {
    this.env     = env;
    this.config  = config;
    this.scaling = opts.scaling ?? 1;

    this.anchor    = { x: 0, y: 0 };
    this.lookRight = false;
    this.time      = 0;       // ticks elapsed; action timing is relative to this
    this.pose      = null;    // last Pose applied → what to draw
    this.dragging  = false;
    this.behavior  = null;
    this.autoEnabled = true;  // false → when a behaviour ends, hold still instead of picking one

    // Host hooks (all optional)
    this.onBehavior = null;   // (name) => void
    this.onSay      = null;   // (text) => void

    env.mascot = this;
  }

  get behaviorName() { return this.behavior ? this.behavior.name : null; }

  setBehavior(behavior) {
    this.behavior = behavior;
    if (this.onBehavior) this.onBehavior(behavior.name);
    behavior.init(this);
  }

  /** Advance one tick (40 ms). Call env.tick() first, like Shimeji's Manager. */
  tick() {
    if (!this.behavior) return;
    this.behavior.next();
    this.time++;
  }

  say(text) {
    if (this.onSay) this.onSay(text);
  }

  /**
   * True once the mascot's image is completely outside the viewport
   * (left of it, right of it or below it). Hanging off the top is fine —
   * that's how Shimeji hides the ceiling pose's head.
   */
  isOutOfScreen(imageSize = 128) {
    const p = this.pose;
    if (!p) return false;
    const s     = this.scaling;
    // The sprite is mirrored about its anchor when looking right.
    const ax    = this.lookRight ? imageSize - p.ax : p.ax;
    const left  = this.anchor.x - ax * s;
    const right = left + imageSize * s;
    const top   = this.anchor.y - p.ay * s;
    const a     = this.env.screen;
    return right <= a.left || a.right <= left || a.bottom <= top;
  }
}
