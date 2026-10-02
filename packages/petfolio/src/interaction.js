/**
 * interaction.js — Pointer wiring.
 *
 * Does NOT animate anything. It only tells the engine what the pointer is
 * doing, the way Shimeji's mouse listener does:
 *
 *   pointermove          → environment cursor position (feeds Dragged and
 *                          the cursor velocity used when thrown)
 *   pointerdown (pet)    → switch to the "Dragged" behaviour (or, while
 *                          peeking from the screen edge, call the pet back)
 *   pointerup            → switch to the "Thrown" behaviour, which launches
 *                          the mascot with the cursor's velocity
 *
 * Everything that happens in between (hanging by the head, swaying, the
 * struggle after being held too long, landing, grabbing a wall it was
 * thrown at) is engine behaviour — see engine/shime-config.js.
 *
 * CLICK-THROUGH: the canvas covers the whole viewport, so it must never
 * steal the host page's clicks, text selection or wheel scrolling. It is
 * `pointer-events: none` except while the pointer is over the pet (or a drag
 * is in progress). We listen on `window` to know where the pointer is.
 */

// ── Pixel-accurate hit testing ──────────────────────────────
// The sprite's box is 128px square with transparent corners; only the visible
// pixels should catch the pointer, so the pet never blocks the page behind it.
const ALPHA_MIN   = 24;            // 0-255: counts as "on the pet"
const TAP_MS      = 350;           // press shorter than this and moving less than TAP_PX = a tap
const TAP_PX      = 8;
const HIT_PADDING = 5;             // px: forgiving margin around the silhouette
const alphaCache  = new WeakMap(); // BaseTexture → { w, h, px } | null

function alphaData(texture) {
  const base = texture.baseTexture;
  if (!base?.valid) return null;
  if (alphaCache.has(base)) return alphaCache.get(base);
  let data = null;
  try {
    const src = base.resource?.source;
    const w = base.realWidth, h = base.realHeight;
    if (src && w && h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(src, 0, 0);
      data = { w, h, px: g.getImageData(0, 0, w, h).data };
    }
  } catch { /* tainted canvas etc. → fall back to the bounding box */ }
  alphaCache.set(base, data);
  return data;
}

/** Is the (screen-space) point on a visible pixel of the sprite? null = can't tell. */
function opaqueAt(sprite, x, y) {
  const tex  = sprite.texture;
  const data = alphaData(tex);
  if (!data) return null;
  const local = sprite.worldTransform.applyInverse({ x, y });
  const tx = Math.floor(local.x + sprite.anchor.x * tex.orig.width  + tex.frame.x);
  const ty = Math.floor(local.y + sprite.anchor.y * tex.orig.height + tex.frame.y);
  if (tx < 0 || ty < 0 || tx >= data.w || ty >= data.h) return false;
  return data.px[(ty * data.w + tx) * 4 + 3] >= ALPHA_MIN;
}

export function initInteraction(self) {
  const sprite = self.sprite;
  const canvas = self.app.view;
  const cursor = self.mascot.env.cursor;

  let dragging = false;
  let down = null;                 // where/when the press started (to tell a tap from a drag)
  let last = null;                 // last pointer position, canvas coords

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Pointer (canvas coords) on the pet's visible silhouette (± HIT_PADDING)? */
  const overPet = (p) => {
    if (!p || !sprite.visible) return false;
    if (!sprite.getBounds().contains(p.x, p.y)) return false;
    const d = HIT_PADDING;
    let known = false;
    for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
      const hit = opaqueAt(sprite, p.x + dx, p.y + dy);
      if (hit) return true;
      if (hit !== null) known = true;
    }
    return !known;                 // no pixel data → fall back to the box
  };

  /** Catch the pointer only while it is on the pet (or holding it). */
  function setHover(on) {
    const active = on || dragging;
    const want = active ? 'auto' : 'none';
    if (canvas.style.pointerEvents !== want) canvas.style.pointerEvents = want;
    const cur = active ? (dragging ? 'grabbing' : 'pointer') : '';
    if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  }

  /** Re-check every frame: the pet may have walked out from under a still cursor. */
  function refresh() {
    if (!dragging) setHover(overPet(last));
  }

  const onMove = (e) => {
    last = local(e);
    cursor.moveTo(last.x, last.y);
    if (!dragging) setHover(overPet(last));
  };

  const onDown = (e) => {
    if (e.button !== 0) return;                       // right-click opens the menu (ui/index.js)
    if (e.target?.closest?.('.pf-ui')) return;        // menu / chat panel are on top of the pet
    last = local(e);
    // A mouse click only counts when the canvas got it (i.e. the pet was
    // under the pointer); touch has no hover, so test the position instead.
    if (e.pointerType === 'mouse' ? e.target !== canvas : !overPet(last)) return;

    e.preventDefault();                               // no text selection while dragging
    // Clicking the peeking pet calls it back instead of dragging it.
    if (self.isPeeking) { self.startAuto(); return; }
    cursor.snapTo(last.x, last.y);
    down = { t: performance.now(), x: e.clientX, y: e.clientY };
    dragging = true;
    setHover(true);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable (synthetic event…) */ }
    self._beginDrag();
  };

  const release = (e) => {
    if (!dragging) return;
    if (e) { last = local(e); cursor.moveTo(last.x, last.y); }
    dragging = false;
    self._endDrag();
    setHover(overPet(last));
    // A short press that barely moved is a tap/click, not a drag: open the menu
    // (this is the only way to reach it on touch screens, which have no right-click).
    if (e?.type === 'pointerup' && down && performance.now() - down.t < TAP_MS
        && Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_PX) {
      self.onTap?.(e.clientX, e.clientY);
    }
    down = null;
  };

  const opts = { capture: true };
  window.addEventListener('pointermove',   onMove,  opts);
  window.addEventListener('pointerdown',   onDown,  opts);
  window.addEventListener('pointerup',     release, opts);
  window.addEventListener('pointercancel', release, opts);
  const onBlur = () => release();
  window.addEventListener('blur',          onBlur,  opts);

  return {
    refresh,
    overPet,
    destroy() {
      window.removeEventListener('pointermove',   onMove,  opts);
      window.removeEventListener('pointerdown',   onDown,  opts);
      window.removeEventListener('pointerup',     release, opts);
      window.removeEventListener('pointercancel', release, opts);
      window.removeEventListener('blur',          onBlur,  opts);
      canvas.style.pointerEvents = 'none';
    },
  };
}
