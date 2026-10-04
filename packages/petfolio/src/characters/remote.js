/**
 * characters/remote.js — Avatars that are not bundled are loaded by name from a CDN.
 *
 * The npm package only contains one default avatar. Every other avatar lives in the
 * repo's /avatars/<name>/ folder and is fetched when a site asks for it:
 *
 *     Petfolio.summon({ character: 'saeyoung' })
 *     → https://cdn.jsdelivr.net/gh/Andrew-Velox/petfolio@main/avatars/saeyoung/shime1.png (…46)
 *
 * Pure functions (no DOM), so they run under Node for tests.
 */

/** Where avatars are downloaded from (jsDelivr serves the GitHub repo with CORS headers). Override with the `avatarBase` option. */
export const DEFAULT_AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/Andrew-Velox/petfolio@main/avatars/';

/** Lowercase letters, digits and dashes — the folder names in /avatars. Keep in sync with scripts/check-avatars.mjs. */
export const AVATAR_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

export const isValidAvatarName = (name) => typeof name === 'string' && AVATAR_NAME.test(name);

/** `<base>/<name>/` — the folder holding shime1.png … shime46.png. */
export function avatarBaseUrl(base, name) {
  if (!isValidAvatarName(name)) throw new Error(`Invalid avatar name "${name}"`);
  const root = typeof base === 'string' && base.trim() ? base.trim() : DEFAULT_AVATAR_BASE;
  return `${root.replace(/\/+$/, '')}/${name}/`;
}

/** The number of frames an avatar has (shime1.png … shimeN.png). */
export const AVATAR_FRAMES = 46;
