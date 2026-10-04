/**
 * engine/index.js — Public surface of the Shimeji-style engine.
 *
 * Nothing in this folder imports Pixi or touches the DOM, so the whole
 * engine can be simulated headlessly (see test/engine.test.mjs).
 */
import { Environment } from './environment.js';
import { Mascot } from './mascot.js';
import { createConfig, STATE_ALIASES } from './shime-config.js';

export { Environment, Mascot, createConfig, STATE_ALIASES };
export { LostGroundError, NOT_ON_BORDER, Ledge } from './environment.js';
export { selectPlatforms, platformsChanged } from './platforms.js';
export { PhysicsGovernor, normalizeMode, PHYSICS_MODES } from './physics-mode.js';

/** Milliseconds per engine tick (Shimeji's Manager.TICK_INTERVAL). */
export const TICK_MS = 40;

/**
 * Convenience: build an environment + mascot + config wired together.
 * @param {() => {width:number,height:number}} getSize
 * @param {object} [opts]  { scaling, config: createConfig options, getScroll: () => ({x, y}) for page ledges }
 */
export function createWorld(getSize, opts = {}) {
  const env    = new Environment(getSize, opts.getScroll ?? null);
  const config = createConfig(opts.config);
  const mascot = new Mascot(env, config, { scaling: opts.scaling ?? 1 });
  return { env, config, mascot };
}
