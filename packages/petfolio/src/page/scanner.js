/**
 * page/scanner.js — Measure the page and build the collision map for physics: 'page'.
 *
 * The scanner runs rarely (load, resize, layout changes, after a long scroll — never
 * per frame) and keeps only STABLE, visible, block-level elements:
 *
 *   in      paragraphs, headings, figures, images, quotes, code blocks, tables, lists,
 *           buttons, header / nav / footer / aside, and anything marked data-petfolio-platform
 *   out     hidden, transparent, covered or too small elements; anything inside a scroll
 *           container or a transformed block (carousels, sliders); sticky elements;
 *           anything animating; anything that moved between two measurements 300 ms apart;
 *           the pet's own UI; anything inside data-petfolio-ignore
 *   fixed   position: fixed elements are kept, but in viewport coordinates (they stay put
 *           when the page scrolls)
 *
 * Positions are page coordinates, so scrolling needs no re-scan.
 * This file only measures; which candidates become platforms is decided in
 * engine/platforms.js (pure, tested).
 */
import { selectPlatforms, platformsChanged, MIN_PLATFORM_WIDTH, MIN_PLATFORM_HEIGHT } from '../engine/platforms.js';

const SELECTOR = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'blockquote', 'pre', 'table',
  'ul', 'ol', 'button', 'header', 'nav', 'footer', 'aside', '[data-petfolio-platform]',
].join(',');

const MAX_ELEMENTS   = 4000;     // looked at (cheap rectangle read)
const MAX_CANDIDATES = 700;      // measured in detail (style walk)
const NEAR_VIEWPORTS = 4;        // only elements within this many viewport heights of the current view
const STABLE_MS      = 300;      // second measurement this long after the first
const STABLE_TOLERANCE = 1;      // px
const DEBOUNCE_MS    = 500;      // quiet time after a layout change before re-scanning
const MIN_INTERVAL_MS = 1000;    // never scan more often than this
const MAX_WAIT_MS    = 2000;     // …and never wait longer than this, however busy the page keeps the observers
const SCROLL_RESCAN   = 1.5;     // re-scan after scrolling this many viewport heights from the last scan

/** Never a platform, whatever the selectors say. */
const isOurs = (el) => !!el.closest?.('.pf-ui, #petfolio-canvas, [data-petfolio-ignore]');

let nextId = 1;
const ids = new WeakMap();
const idOf = (el) => {
  let id = ids.get(el);
  if (id === undefined) { id = nextId++; ids.set(el, id); }
  return id;
};

/**
 * What the ancestors of `el` mean for it: `fixed` (viewport-anchored) or `bad` (it moves in ways a
 * page-coordinate map can't follow: sticky, transformed, inside a scroller). Memoised per scan.
 */
function context(el, memo) {
  if (!el || el === document.documentElement) return { fixed: false, bad: false };
  const hit = memo.get(el);
  if (hit) return hit;
  const parent = context(el.parentElement, memo);
  const cs = getComputedStyle(el);
  const fixed = parent.fixed || cs.position === 'fixed';
  const scroller = el !== document.body
    && /(auto|scroll)/.test(cs.overflowX + cs.overflowY)
    && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
  const bad = parent.bad
    || cs.position === 'sticky'
    || (cs.transform && cs.transform !== 'none')
    || scroller;
  const result = { fixed, bad };
  memo.set(el, result);
  return result;
}

/** Page (or, for fixed elements, viewport) rectangle of an element. */
function measure(el, fixed) {
  const r = el.getBoundingClientRect();
  const sx = fixed ? 0 : window.scrollX;
  const sy = fixed ? 0 : window.scrollY;
  return { left: r.left + sx, top: r.top + sy, right: r.right + sx, bottom: r.bottom + sy };
}

const same = (a, b) =>
  Math.abs(a.left - b.left) <= STABLE_TOLERANCE && Math.abs(a.top - b.top) <= STABLE_TOLERANCE
  && Math.abs(a.right - b.right) <= STABLE_TOLERANCE && Math.abs(a.bottom - b.bottom) <= STABLE_TOLERANCE;

/** Is something else painted over the top edge of `el` (a modal, a cookie banner…)? Only testable on screen. */
function covered(el, rect, fixed) {
  const sx = fixed ? 0 : window.scrollX;
  const sy = fixed ? 0 : window.scrollY;
  const x = Math.min(window.innerWidth - 1, Math.max(0, (rect.left + rect.right) / 2 - sx));
  const y = rect.top - sy + Math.min(6, (rect.bottom - rect.top) / 2);
  if (y < 0 || y >= window.innerHeight) return false;
  const hit = document.elementFromPoint(x, y);
  if (!hit || hit.closest?.('.pf-ui')) return false;
  return !(el.contains(hit) || hit.contains(el));
}

/** First pass: everything that might be a platform, measured once. */
function collect() {
  const vh = window.innerHeight;
  const memo = new Map();
  const out = [];

  const all = document.querySelectorAll(SELECTOR);
  for (let i = 0; i < all.length && i < MAX_ELEMENTS && out.length < MAX_CANDIDATES; i++) {
    const el = all[i];
    const forced = el.hasAttribute('data-petfolio-platform');
    const r = el.getBoundingClientRect();
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    if (!w || !h) continue;                                           // display:none / empty
    if (!forced && (w < MIN_PLATFORM_WIDTH || h < MIN_PLATFORM_HEIGHT)) continue;
    // Far from the current view: skip (a long scroll triggers a re-scan).
    if (r.bottom < -NEAR_VIEWPORTS * vh || r.top > (NEAR_VIEWPORTS + 1) * vh) continue;
    if (isOurs(el)) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const ctx = context(el, memo);
    if (ctx.bad && !forced) continue;
    if (cs.position === 'sticky') continue;
    if (el.getAnimations && el.getAnimations().length) continue;      // running animation / transition

    // Only the viewport-anchored header/nav kind may be fixed; any other fixed element (a toast,
    // a floating button) is not a surface.
    if (ctx.fixed && !forced && !/^(HEADER|NAV|ASIDE|FOOTER)$/.test(el.tagName)) continue;

    const rect = measure(el, ctx.fixed);
    if (covered(el, rect, ctx.fixed)) continue;
    out.push({ el, id: idOf(el), fixed: ctx.fixed, forced, rect });
  }
  return out;
}

/**
 * @param {object} opts
 * @param {(platforms: import('../engine/platforms.js').Platform[], changed: boolean) => void} opts.onMap
 *        called after every scan with the new map; `changed` = it differs from the previous one
 */
export function createPageScanner({ onMap }) {
  let running = false;
  let timer = 0;            // debounce timer
  let settleTimer = 0;      // second-measurement timer
  let lastScan = 0;
  let pendingSince = 0;     // when the oldest not-yet-started scan was requested (0 = none)
  let lastScrollY = 0;
  let scrollTimer = 0;
  let current = [];         // the map as last reported
  let ro = null;
  let mo = null;

  const clear = () => { clearTimeout(timer); clearTimeout(settleTimer); clearTimeout(scrollTimer); timer = settleTimer = scrollTimer = pendingSince = 0; };

  function scan() {
    pendingSince = 0;
    clearTimeout(settleTimer);
    lastScan = performance.now();
    lastScrollY = window.scrollY;
    const first = collect();
    // Second measurement: whatever moved in the meantime is not stable.
    settleTimer = setTimeout(() => {
      if (!running) return;
      const stable = [];
      for (const c of first) {
        if (!c.el.isConnected) continue;
        const now = measure(c.el, c.fixed);
        // page coordinates, so scrolling in between does not count as movement
        if (same(c.rect, now)) stable.push({ id: c.id, ...now, fixed: c.fixed, forced: c.forced });
      }
      const next = selectPlatforms(stable);
      const changed = platformsChanged(current, next);
      current = next;
      onMap(next, changed);
    }, STABLE_MS);
  }

  /** Scan soon (debounced, rate-limited). */
  function schedule(delay = DEBOUNCE_MS) {
    if (!running) return;
    const now = performance.now();
    if (!pendingSince) pendingSince = now;
    clearTimeout(timer);
    // Debounced, but a page that mutates constantly must not starve the scan (a stale map
    // is worse than a busy one): after MAX_WAIT_MS it runs anyway.
    const wait = Math.max(Math.min(delay, pendingSince + MAX_WAIT_MS - now), MIN_INTERVAL_MS - (now - lastScan), 0);
    timer = setTimeout(scan, wait);
  }

  const onResize = () => schedule();
  const onLoad = () => schedule();               // images / fonts finishing change the layout
  const onScroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (Math.abs(window.scrollY - lastScrollY) > window.innerHeight * SCROLL_RESCAN) schedule(0);
    }, 250);
  };

  return {
    get platforms() { return current; },

    start() {
      if (running || typeof document === 'undefined') return;
      running = true;
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('load', onLoad, true);
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => schedule());
        ro.observe(document.documentElement);
        if (document.body) ro.observe(document.body);
      }
      if (typeof MutationObserver !== 'undefined' && document.body) {
        mo = new MutationObserver((records) => {
          // Ignore the pet's own DOM (its menu and chat live in the page too).
          if (records.every((r) => isOurs(r.target))) return;
          schedule();
        });
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
      }
      if (document.readyState === 'complete') scan();
      else window.addEventListener('load', () => schedule(0), { once: true });
      document.fonts?.ready?.then(() => schedule()).catch(() => {});
    },

    stop() {
      if (!running) return;
      running = false;
      clear();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('load', onLoad, true);
      ro?.disconnect(); mo?.disconnect(); ro = mo = null;
      current = [];
    },

    /** Scan now-ish (e.g. after the host knows the layout changed). */
    rescan() { schedule(0); },
  };
}
