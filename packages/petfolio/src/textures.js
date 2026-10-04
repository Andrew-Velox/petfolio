/**
 * textures.js — Sprite lookup for the active character.
 *
 * The engine refers to sprites by number (Shimeji's `shime{N}.png`), so a
 * character is just "number → texture". Resolution order for each sprite:
 *   1. per-character inline data (bundled base64 from characters.js)
 *   2. otherwise `${dir}shime{N}.png` — the dev-mode /sprites/ folder, or an avatar CDN folder
 *      (see characters/remote.js)
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

/**
 * Resolves once the texture's image has downloaded; rejects if it fails or takes too long
 * (404, blocked by a Content-Security-Policy, offline…).
 * @param {PIXI.Texture} texture
 * @param {number} [timeoutMs=10000]
 */
export function whenLoaded(texture, timeoutMs = 10000) {
  const base = texture.baseTexture;
  return new Promise((resolve, reject) => {
    if (base.valid) { resolve(); return; }
    let timer = 0;
    const finish = (error) => {
      clearTimeout(timer);
      base.off('loaded', onLoaded);
      base.off('error', onError);
      if (error) reject(error); else resolve();
    };
    const onLoaded = () => finish();
    const onError = () => finish(new Error('the download failed'));
    timer = setTimeout(() => finish(new Error('the download timed out')), timeoutMs);
    base.once('loaded', onLoaded);
    base.once('error', onError);
  });
}
