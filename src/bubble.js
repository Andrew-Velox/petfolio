/**
 * bubble.js — Speech-bubble factory.
 *
 * Creates a floating text box that follows the pet sprite.
 *
 * Options:
 *   mirrorOnFacing  – flip sides based on sprite facing direction
 *   sideOffset      – px shift added to pet.x for x-position
 *   offsetYExtra    – px subtracted from pet.y for y-position
 *   showPointer     – draw a triangular arrow tail
 */
import * as PIXI from 'pixi.js';

/**
 * @param {PIXI.AnimatedSprite} petSprite
 * @param {string}              initialText
 * @param {object}              [opts]
 * @returns {{ container: PIXI.Container, setText: Function, show: Function, hide: Function, follow: Function }}
 */
export function makeBubble(petSprite, initialText, opts = {}) {
  const mirrorOnFacing = opts.mirrorOnFacing !== false;
  const sideOffset     = opts.sideOffset     ?? -50;
  const offsetYExtra   = opts.offsetYExtra   ?? -55;
  const showPointer    = opts.showPointer === true;

  const PAD_X = 12;
  const PAD_Y = 8;
  const MAX_W = 220;

  const container = new PIXI.Container();
  container.visible = false;

  const bg  = new PIXI.Graphics();
  container.addChild(bg);

  const txt = new PIXI.Text(initialText || '', {
    fontFamily: 'sans-serif',
    fontSize:   14,
    fill:       0xffffff,
    wordWrap:   true,
    wordWrapWidth: MAX_W,
  });
  txt.x = PAD_X;
  txt.y = PAD_Y;
  container.addChild(txt);

  let lastFacingRight = null;

  function redraw() {
    bg.clear();
    const w = txt.width  + PAD_X * 2;
    const h = txt.height + PAD_Y * 2;

    if (mirrorOnFacing) {
      const facingRight = petSprite.scale.x < 0;
      const xOff = facingRight ? 0 : -w;
      bg.beginFill(0x000000, 0.8);
      bg.lineStyle(2, 0x6366f1, 1);
      bg.drawRoundedRect(xOff, -h, w, h, 10);
      bg.endFill();
      txt.x = xOff + PAD_X;
      txt.y = -h   + PAD_Y;
    } else {
      const radius = showPointer ? 6 : 10;
      bg.beginFill(0x000000, 0.8);
      bg.lineStyle(2, 0x6366f1, 1);
      bg.drawRoundedRect(-w, -h, w, h, radius);
      bg.endFill();
      if (showPointer) {
        const tailW = 16, tailH = 14, tailInset = 4;
        bg.beginFill(0x000000, 0.8);
        bg.lineStyle(2, 0x6366f1, 1);
        bg.moveTo(-tailInset, 0);
        bg.lineTo(-tailInset - tailW, 0);
        bg.lineTo(-tailInset, tailH);
        bg.closePath();
        bg.endFill();
      }
      txt.x = -w + PAD_X;
      txt.y = -h + PAD_Y;
    }
  }

  function layoutIfFacingFlipped() {
    if (!mirrorOnFacing) return;
    const facingRight = petSprite.scale.x < 0;
    if (facingRight !== lastFacingRight) {
      lastFacingRight = facingRight;
      redraw();
    }
  }

  return {
    container,
    setText(s) {
      txt.text = String(s == null ? '' : s);
      lastFacingRight = petSprite.scale.x < 0;
      redraw();
    },
    show() { container.visible = true;  },
    hide() { container.visible = false; },
    follow() {
      if (!container.visible) return;
      const offsetY = (petSprite.height * Math.abs(petSprite.scale.y)) + offsetYExtra;
      layoutIfFacingFlipped();
      container.x = petSprite.x + sideOffset;
      container.y = petSprite.y - offsetY;
      container.scale.x = 1;
      txt.scale.x       = 1;
    },
  };
}
