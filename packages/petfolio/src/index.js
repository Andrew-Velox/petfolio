/**
 * index.js — NPM package entry-point.
 *
 * Usage:
 *   import { Petfolio } from 'petfolio';
 *   Petfolio.summon();                      // quick start
 *   Petfolio.summon({ autoStart: false });   // manual control
 *
 * Or with a script tag:
 *   <script src="https://unpkg.com/petfolio"></script>
 *   <script>Petfolio.summon();</script>
 */
export { Petfolio } from './Petfolio.js';

import { Petfolio as _Petfolio } from './Petfolio.js';

/**
 * Quick-start: creates a fullscreen transparent canvas, spawns
 * the pet, and starts auto-pilot. Returns the Petfolio instance.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.autoStart=true]   Start auto-pilot immediately
 * @param {string}  [opts.spriteDir]        Override sprite directory
 * @param {number}  [opts.scale]            Override sprite scale
 * @returns {_Petfolio}
 */
_Petfolio.summon = function summon(opts = {}) {
  const {
    autoStart = true,
    spriteDir,
    scale,
  } = opts;

  // ── Create a fullscreen transparent canvas ──────────────
  let canvas = document.getElementById('petfolio-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'petfolio-canvas';
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

  const pet = new _Petfolio(canvas, petOpts);

  if (scale) {
    pet.sprite.scale.set(scale);
  }

  if (autoStart) {
    pet.startAuto();
  }

  return pet;
};