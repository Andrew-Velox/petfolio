/**
 * engine/behavior.js — Behaviours and the weighted "what next?" picker.
 *
 * Port of Shimeji's UserBehavior, BehaviorBuilder and
 * Configuration.buildNextBehavior().
 *
 * A Behavior = a top-level Action with a name. Auto-pilot is nothing more
 * than this loop:
 *
 *     behaviour finishes
 *         → candidates = every top-level behaviour that has Frequency > 0
 *                        and whose Conditions hold right now
 *                      + the finished behaviour's own NextBehaviorList
 *         → pick one at random, weighted by Frequency
 *         → start it
 *
 * Conditions are what make it look alive: "on the floor" offers walking,
 * sitting and wall-running; "on a wall" offers climbing and falling;
 * "on the ceiling" offers crawling and dropping. The mascot never needs a
 * hand-written state machine.
 */
import { LostGroundError } from './environment.js';
import { buildAction } from './actions.js';

const MAX_CHAIN = 16; // guards against behaviours whose action finishes instantly, forever

export class Behavior {
  constructor(name, action, config, opts = {}) {
    this.name   = name;
    this.action = action;
    this.config = config;
    this.allowOffscreen = !!opts.allowOffscreen;
    this.mascot = null;
  }

  init(mascot) {
    this.mascot = mascot;
    this.action.init(mascot);
    // Nothing to do at all (e.g. every condition failed): chain on.
    if (!this.action.hasNext()) this._finish(mascot);
  }

  next() {
    const m = this.mascot;
    if (!m) return;

    try {
      if (this.action.hasNext()) this.action.next();

      if (this.action.hasNext()) {
        // Still running. If the mascot has wandered completely out of view
        // (viewport resized under it, …) drop it back in from the sky.
        if (!this.allowOffscreen && m.isOutOfScreen()) {
          this.config.respawnFromSky(m);
          m.setBehavior(this.config.buildBehavior('Fall'));
        }
      } else {
        this._finish(m);
      }
    } catch (e) {
      if (!(e instanceof LostGroundError)) throw e;
      // Walked off its border (or broke free while being held): fall.
      m.dragging = false;
      m.setBehavior(this.config.buildBehavior('Fall'));
    }
  }

  _finish(mascot) {
    mascot.chainDepth = (mascot.chainDepth ?? 0) + 1;
    try {
      if (mascot.chainDepth > MAX_CHAIN) {
        // Something is producing empty behaviours; break the loop safely.
        mascot.setBehavior(this.config.buildHold(mascot));
      } else {
        // With auto-pilot off the mascot just holds still — unless this
        // behaviour has a mandatory follow-up (Exit → Peek).
        const chain = mascot.autoEnabled || this.config.forcesNext(this.name);
        mascot.setBehavior(
          chain
            ? this.config.buildNextBehavior(this.name, mascot)
            : this.config.buildHold(mascot),
        );
      }
    } finally {
      mascot.chainDepth--;
    }
  }
}

/**
 * Declarative behaviour: name, weight, extra conditions, follow-ups.
 *   next: { add: boolean, refs: [{ name, frequency, condition? }] }
 *   add = true  → follow-ups are offered IN ADDITION to the global pool
 *   add = false → ONLY the listed follow-ups are offered
 */
export class BehaviorBuilder {
  constructor(name, frequency, opts = {}) {
    this.name        = name;
    this.frequency   = frequency;
    this.conditions  = opts.conditions ?? [];
    this.actionName  = opts.action ?? name;
    this.nextAdd     = opts.next ? opts.next.add : true;
    this.nextRefs    = opts.next ? opts.next.refs : [];
    this.allowOffscreen = !!opts.allowOffscreen;
    this.forceNext      = !!opts.forceNext;   // follow-up even when auto-pilot is off
  }

  isEffective(mascot) {
    if (this.frequency === 0) return false;
    return this.conditions.every((c) => c(mascot));
  }
}

export class Configuration {
  /**
   * @param {Record<string, object>} actions     action specs by name
   * @param {BehaviorBuilder[]}      behaviors
   * @param {object} [hooks]
   */
  constructor(actions, behaviors) {
    this.actions   = actions;
    this.behaviors = new Map(behaviors.map((b) => [b.name, b]));
  }

  has(name) { return this.behaviors.has(name); }
  forcesNext(name) { return !!this.behaviors.get(name)?.forceNext; }

  buildBehavior(name) {
    const b = this.behaviors.get(name);
    if (!b) throw new Error(`Unknown behavior "${name}"`);
    return new Behavior(name, buildAction({ kind: 'Ref', name: b.actionName, params: {} }, this.actions), this, {
      allowOffscreen: b.allowOffscreen,
    });
  }

  /** Weighted random pick — Configuration.buildNextBehavior() in Shimeji. */
  buildNextBehavior(previousName, mascot) {
    const prev = previousName ? this.behaviors.get(previousName) : null;
    const candidates = [];
    let total = 0;

    if (!prev || prev.nextAdd) {
      for (const b of this.behaviors.values()) {
        if (b.isEffective(mascot)) { candidates.push([b.name, b.frequency]); total += b.frequency; }
      }
    }
    if (prev) {
      for (const r of prev.nextRefs) {
        if (r.frequency > 0 && (!r.condition || r.condition(mascot))) {
          candidates.push([r.name, r.frequency]); total += r.frequency;
        }
      }
    }

    if (total > 0) {
      let roll = Math.random() * total;
      for (const [name, freq] of candidates) {
        roll -= freq;
        if (roll < 0) return this.buildBehavior(name);
      }
    }

    // No candidate at all → drop in from the sky.
    this.respawnFromSky(mascot);
    return this.buildBehavior('Fall');
  }

  /**
   * Behaviour used when auto-pilot is OFF: hold still wherever the mascot
   * is (physics still applies — in mid-air it falls).
   */
  buildHold(mascot) {
    const env = mascot.env;
    if (env.floor.isOn(mascot.anchor))   return this.buildBehavior('Idle');
    if (env.wall.isOn(mascot.anchor))    return this.buildBehavior('HoldWall');
    if (env.ceiling.isOn(mascot.anchor)) return this.buildBehavior('HoldCeiling');
    return this.buildBehavior('Fall');
  }

  respawnFromSky(mascot) {
    const a = mascot.env.workArea;
    // width-2 / +1 keeps the new x strictly between the walls so it falls
    // instead of immediately clinging to one.
    mascot.anchor.x = Math.floor(Math.random() * (a.width - 2)) + a.left + 1;
    mascot.anchor.y = a.top - 256;
  }
}
