/**
 * page/physics.js — Connects the page scanner to the engine and picks the physics mode.
 *
 * Owns no pet logic: it measures the page (scanner.js), asks the PhysicsGovernor which
 * mode is right *now* (engine/physics-mode.js) and sets the engine up for it:
 *
 *   floor   no ledges, no corner parking (the classic pet)
 *   page    the scanner's collision map goes into the environment as ledges
 *   corner  no ledges; the pet parks in the bottom corner and idles
 *
 * The mode is re-evaluated every second and whenever the map changes, so a pet in
 * 'page' mode drops back to 'floor' by itself on a phone, with reduced motion, on
 * a page with too few surfaces, or on a layout that never settles.
 */
import { PhysicsGovernor, normalizeMode } from '../engine/physics-mode.js';
import { createPageScanner } from './scanner.js';

const CHECK_MS = 1000;

/** Reasons that make the scan pointless: don't measure the page at all. */
const NO_SCAN = new Set(['reduced-motion', 'touch-only', 'narrow-viewport', 'unstable']);

/**
 * @param {{env: import('../engine/environment.js').Environment, mascot: object, config: object}} pet
 * @param {'floor'|'page'|'corner'} requested
 */
export function createPhysics(pet, requested) {
  const env = pet.env;
  const governor = new PhysicsGovernor(requested);
  let mode = 'floor';
  let reason = null;
  let timer = 0;
  let destroyed = false;

  const query = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);

  const scanner = createPageScanner({
    onMap(platforms, changed) {
      if (destroyed) return;
      if (changed) governor.note('change', performance.now());
      if (mode === 'page') env.setPlatforms(platforms);
      evaluate();
    },
  });

  function evaluate() {
    if (destroyed) return;
    const result = governor.evaluate({
      width: window.innerWidth,
      touchOnly: query('(hover: none) and (pointer: coarse)'),
      reducedMotion: query('(prefers-reduced-motion: reduce)'),
      platformCount: scanner.platforms.length,
    }, performance.now());

    const wantScan = governor.requested === 'page' && !NO_SCAN.has(result.reason);
    if (wantScan) scanner.start(); else scanner.stop();

    reason = result.reason;
    if (result.mode === mode) return;
    mode = result.mode;
    env.cornerMode = mode === 'corner';
    // page → the map; anything else → no ledges (a pet standing on one loses its footing and falls)
    env.setPlatforms(mode === 'page' ? scanner.platforms : []);
    if (mode === 'corner' && env.floor.isOn(pet.mascot.anchor) && pet.mascot.behaviorName !== 'Dragged') {
      pet.mascot.setBehavior(pet.config.buildBehavior('GoToCorner'));
    }
  }

  timer = setInterval(evaluate, CHECK_MS);
  evaluate();

  return {
    get mode() { return mode; },
    /** Why 'page' is not in use (null when it is, or was not asked for). */
    get reason() { return reason; },
    get requested() { return governor.requested; },
    set(next) { governor.request(normalizeMode(next)); evaluate(); },
    /** The pet lost its footing (LostGroundError → Fall). Feeds the stability check. */
    noteFall() { governor.note('fall', performance.now()); },
    destroy() {
      destroyed = true;
      clearInterval(timer);
      scanner.stop();
      env.setPlatforms([]);
    },
  };
}
