/**
 * interaction.js — Pointer wiring.
 *
 * Does NOT animate anything. It only tells the engine what the pointer is
 * doing, the way Shimeji's mouse listener does:
 *
 *   pointermove          → environment cursor position (feeds Dragged and
 *                          the cursor velocity used when thrown)
 *   pointerdown (sprite) → switch to the "Dragged" behaviour (or, while
 *                          peeking from the screen edge, call the pet back)
 *   pointerup            → switch to the "Thrown" behaviour, which launches
 *                          the mascot with the cursor's velocity
 *
 * Everything that happens in between (hanging by the head, swaying, the
 * struggle after being held too long, landing, grabbing a wall it was
 * thrown at) is engine behaviour — see engine/shime-config.js.
 */

export function initInteraction(self) {
  const sprite = self.sprite;
  const stage  = self.app.stage;
  const cursor = self.mascot.env.cursor;

  sprite.interactive = true;
  sprite.buttonMode  = true;
  sprite.cursor      = 'pointer';

  stage.interactive = true;
  stage.hitArea     = self.app.screen;   // live-resizing Rectangle

  const pos = (e) => {
    const g = e?.data?.global || e?.global || {};
    return { x: g.x || 0, y: g.y || 0 };
  };

  sprite.on('pointerdown', (e) => {
    // Only the left button drags; right/middle are handled elsewhere
    // (ui/index.js opens the menu on right-click).
    const button = e.button ?? e.data?.button ?? 0;
    if (button !== 0) return;
    // Clicking the peeking pet calls it back instead of dragging it.
    if (self.isPeeking) { self.startAuto(); return; }
    const { x, y } = pos(e);
    cursor.snapTo(x, y);
    self._beginDrag();
  });

  stage.on('pointermove', (e) => {
    const { x, y } = pos(e);
    cursor.moveTo(x, y);
  });

  const release = (e) => {
    const { x, y } = pos(e);
    cursor.moveTo(x, y);
    self._endDrag();
  };
  stage.on('pointerup',        release);
  stage.on('pointerupoutside', release);
}
