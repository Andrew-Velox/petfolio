/**
 * index.js — NPM package entry-point.
 *
 * Usage:
 *   import { MishiPet } from 'mishi-pet';
 *   MishiPet.summon();                      // quick start
 *   MishiPet.summon({ autoStart: false });   // manual control
 *
 * Or with a script tag:
 *   <script src="https://unpkg.com/mishi-pet"></script>
 *   <script>MishiPet.summon();</script>
 */
export { MishiPet } from './MishiPet.js';

import { MishiPet as _MishiPet } from './MishiPet.js';

/**
 * Quick-start: creates a fullscreen transparent canvas, spawns
 * the pet, and starts auto-pilot. Returns the MishiPet instance.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.autoStart=true]   Start auto-pilot immediately
 * @param {string}  [opts.spriteDir]        Override sprite directory
 * @param {number}  [opts.scale]            Override sprite scale
 * @returns {_MishiPet}
 */
_MishiPet.summon = function summon(opts = {}) {
  const {
    autoStart = true,
    spriteDir,
    scale,
  } = opts;

  // ── Create a fullscreen transparent canvas ──────────────
  let canvas = document.getElementById('mishi-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'mishi-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(canvas);
  }
  // The canvas itself is pointer-events:none so clicks pass
  // through, but the sprite inside gets interactive = true
  // which Pixi handles at the renderer level.
  canvas.style.pointerEvents = 'auto';

  // ── Spawn the pet ───────────────────────────────────────
  const petOpts = {};
  if (spriteDir) petOpts.spriteDir = spriteDir;

  const pet = new _MishiPet(canvas, petOpts);

  if (scale) {
    pet.sprite.scale.set(scale);
  }

  if (autoStart) {
    pet.startAuto();
  }

  return pet;
};
