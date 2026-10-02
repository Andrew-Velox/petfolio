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
import { CHARACTERS } from './characters/characters.js';

/**
 * Quick-start: creates a fullscreen transparent canvas, spawns
 * the pet, and starts auto-pilot. Returns the Petfolio instance.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.autoStart=true]   Start auto-pilot immediately
 * @param {string}  [opts.spriteDir]        Override sprite directory
 * @param {string}  [opts.character]        Character key (e.g. 'an2', 'finn')
 * @param {number}  [opts.scale]            Override sprite scale
 * @param {boolean} [opts.ui=true]         Right-click menu + chat (false = no UI)
 * @param {string}  [opts.name]             Persona name for the chat
 * @param {object}  [opts.ai]               { knowledge, endpoint, apiKey, provider, model }
 * @param {string[]} [opts.phrases]        Cute lines for the SayHi greeting and random chatter
 * @param {boolean|object} [opts.chatter]  false = no random speech bubbles; { min, max } seconds between them
 * @param {string[]} [opts.suggestions]    Starter questions shown as chips in the chat ([] = none)
 * @param {Function} [opts.onSettings]      Settings button callback
 * @param {number}  [opts.idleScale]        Multiplier for long idle periods (1 = original Shimeji, <1 = livelier)
 * @returns {_Petfolio}
 */
_Petfolio.summon = function summon(opts = {}) {
  const {
    autoStart = true,
    spriteDir,
    scale,
    character,
    idleScale,
    ui,
    name,
    ai,
    suggestions,
    phrases,
    chatter,
    onSettings,
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
  if (character) petOpts.character = character;
  if (scale) petOpts.scale = scale;
  if (idleScale) petOpts.idleScale = idleScale;
  if (ui !== undefined) petOpts.ui = ui;
  if (name) petOpts.name = name;
  if (ai) petOpts.ai = ai;
  if (suggestions) petOpts.suggestions = suggestions;
  if (phrases) petOpts.phrases = phrases;
  if (chatter !== undefined) petOpts.chatter = chatter;
  if (onSettings) petOpts.onSettings = onSettings;

  const pet = new _Petfolio(canvas, petOpts);

  if (autoStart) {
    pet.startAuto();
  }

  return pet;
};

/**
 * List all registered character keys.
 * @returns {string[]}
 */
_Petfolio.availableCharacters = function () {
  return Object.keys(CHARACTERS);
};