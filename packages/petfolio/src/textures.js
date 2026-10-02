/**
 * textures.js — Sprite lookup for the active character.
 *
 * The engine refers to sprites by number (Shimeji's `shime{N}.png`), so a
 * character is just "number → texture". Resolution order for each sprite:
 *   1. per-character inline data (bundled base64 from characters.js)
 *   2. dev-mode fallback: `${dir}shime{N}.png` (served from /sprites/)
 */
import * as PIXI from 'pixi.js';

/**
 * @param {string} dir          dev-mode sprite path prefix
 * @param {object} spriteData   filename → data URL for this character
 * @returns {(n:number) => PIXI.Texture}
 */
export function makeTextureLoader(dir, spriteData) {
  const cache = new Map();
  return function texture(n) {
    let tex = cache.get(n);
    if (!tex) {
      const filename = `shime${n}.png`;
      tex = PIXI.Texture.from(spriteData?.[filename] || `${dir}${filename}`);
      cache.set(n, tex);
    }
    return tex;
  };
}
