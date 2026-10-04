/**
 * engine/platforms.js — Turn measured page elements into a simple "collision map".
 *
 * Pure functions (no DOM), so they run under Node for tests. The DOM side
 * (src/page/scanner.js) measures elements and hands the rectangles here; this file
 * decides which of them are worth standing on.
 *
 * A platform is the TOP edge of an element: a one-way ledge. The pet lands on it
 * from above and can jump or fall through it from below. Nothing else about the
 * element matters, so the map stays tiny and the pet can never be trapped inside it.
 *
 * Coordinates are page (document) coordinates, so scrolling is just a subtraction —
 * except `fixed` platforms (position: fixed), which live in viewport coordinates.
 */

export const MIN_PLATFORM_WIDTH  = 96;    // px; a ledge narrower than a pet is no ledge
export const MIN_PLATFORM_HEIGHT = 16;    // px; hairlines and spacers are not surfaces
export const MAX_PLATFORMS       = 600;
const MERGE_DY      = 6;                  // ledges this close in height…
const MERGE_OVERLAP = 0.6;                // …and overlapping this much sideways are one ledge

/**
 * @typedef {object} Candidate  a measured element
 * @property {string|number} id   stable per element (so a re-scan can match it up)
 * @property {number} left @property {number} top @property {number} right @property {number} bottom
 * @property {boolean} [fixed]    position: fixed → viewport coordinates
 * @property {boolean} [forced]   the page owner asked for it (data-petfolio-platform): never merged away, never dropped
 */

/**
 * @typedef {object} Platform
 * @property {string|number} id
 * @property {number} left @property {number} top @property {number} right
 * @property {boolean} fixed
 * @property {boolean} forced
 */

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** How much of the narrower of the two ranges is shared (0…1). */
function overlap(a, b) {
  const shared = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const narrow = Math.min(a.right - a.left, b.right - b.left);
  return narrow > 0 ? Math.max(0, shared) / narrow : 0;
}

/**
 * Pick the platforms from measured candidates: drops thin / tiny / broken
 * rectangles, merges near-duplicates (a <section> and its first <p> share a top
 * edge) and caps the count.
 * @param {Candidate[]} candidates
 * @param {{minWidth?:number, minHeight?:number, max?:number}} [opts]
 * @returns {Platform[]}  sorted top to bottom
 */
export function selectPlatforms(candidates, opts = {}) {
  const minWidth  = opts.minWidth  ?? MIN_PLATFORM_WIDTH;
  const minHeight = opts.minHeight ?? MIN_PLATFORM_HEIGHT;
  const max       = opts.max       ?? MAX_PLATFORMS;

  const usable = [];
  for (const c of candidates) {
    if (!c || ![c.left, c.top, c.right, c.bottom].every(finite)) continue;
    const w = c.right - c.left;
    const h = c.bottom - c.top;
    if (w < 0 || h < 0) continue;
    if (!c.forced && (w < minWidth || h < minHeight)) continue;
    if (c.forced && w < 8) continue;            // even a forced ledge needs some width
    usable.push({
      id: c.id,
      left: Math.round(c.left), top: Math.round(c.top), right: Math.round(c.right),
      fixed: !!c.fixed, forced: !!c.forced,
    });
  }
  usable.sort((a, b) => a.top - b.top || a.left - b.left);

  // Merge near-duplicates. Everything within MERGE_DY above the current one is a
  // candidate for merging, so only the tail of `kept` needs checking.
  const kept = [];
  for (const p of usable) {
    let merged = false;
    for (let i = kept.length - 1; i >= 0 && p.top - kept[i].top <= MERGE_DY; i--) {
      const k = kept[i];
      if (k.fixed !== p.fixed || overlap(k, p) < MERGE_OVERLAP) continue;
      if (k.forced && p.forced) continue;       // two forced ledges both stay
      if (p.forced || (!k.forced && p.right - p.left > k.right - k.left)) kept[i] = p;
      merged = true;
      break;
    }
    if (!merged) kept.push(p);
  }

  if (kept.length <= max) return kept;
  // Too many: keep the forced ones, then the widest.
  return kept
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.forced - a.p.forced) || ((b.p.right - b.p.left) - (a.p.right - a.p.left)))
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.p);
}

/**
 * Have the platforms changed in a way that matters? (Ignores sub-2px noise.)
 * Used to tell a real layout change from a re-scan that found the same page.
 */
export function platformsChanged(prev, next, tolerance = 2) {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id || a.fixed !== b.fixed) return true;
    if (Math.abs(a.top - b.top) > tolerance || Math.abs(a.left - b.left) > tolerance
        || Math.abs(a.right - b.right) > tolerance) return true;
  }
  return false;
}
