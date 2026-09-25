/**
 * interaction.js — Pointer drag / throw wiring.
 *
 * Sets up pointerdown, pointermove, pointerup on the sprite and stage.
 * All handlers close over the MishiPet instance (`self`).
 */
import * as PIXI from 'pixi.js';
import { DRAG_SPEED_THRESHOLD, TRANSITION_HOLD } from './constants.js';

export function initInteraction(self) {
  const pet   = self.sprite;
  const stage = self.app.stage;

  pet.interactive = true;
  pet.buttonMode  = true;
  pet.cursor      = 'pointer';

  stage.interactive = true;
  stage.hitArea = new PIXI.Rectangle(
    0, 0,
    Math.max(window.innerWidth,  self.app.renderer.width),
    Math.max(window.innerHeight, self.app.renderer.height),
  );

  // --- pointer down (start drag) ---
  pet.on('pointerdown', (e) => {
    if (self.state === 'land') pet.onComplete = null;

    self._isDragging = true;
    self._isFalling  = false;
    self._velocityX  = 0;
    self._velocityY  = 0;

    // Interrupt any running auto-pilot step timer
    clearTimeout(self._autoTimer);
    self._autoTimer = null;

    const stateAtGrab = (self.state === 'falling' || self.state === 'held')
      ? self.previousState : self.state;
    self.previousState = stateAtGrab;
    self.state = 'held';

    pet.textures       = self.animations.held;
    pet.animationSpeed = 0.2;
    pet.loop           = true;
    pet.gotoAndStop(0);
    pet.scale.x = Math.abs(pet.scale.x);

    self._dragDirection   = 0;
    self._dragSpeedBucket = 'slow';
    self._transFrames     = null;
    self._transFrameIdx   = 0;
    self._transHoldFrames = 0;

    const g = (e.data?.global) || e.global || {};
    self._lastPointerX = g.x || 0;
    self._lastPointerY = g.y || 0;
    self._prevPointerX = self._lastPointerX;
    self._prevPointerY = self._lastPointerY;
    self._dragOffsetX  = pet.x - (g.x || 0);
    self._dragOffsetY  = pet.y - (g.y || 0);
  });

  // --- pointer move (while dragging) ---
  stage.on('pointermove', (e) => {
    if (!self._isDragging) return;
    const g = (e.data?.global) || e.global || {};
    const newX = g.x || 0;
    const newY = g.y || 0;
    const dx   = newX - self._prevPointerX;
    const fast = Math.abs(dx) > DRAG_SPEED_THRESHOLD;

    if (fast) self._dragDirection = dx > 0 ? 1 : -1;

    const nextBucket   = fast ? 'fast' : 'slow';
    const bucketChanged = nextBucket !== self._dragSpeedBucket;

    if (bucketChanged) {
      if (self._dragDirection === 0) {
        pet.textures       = self.animations.held;
        pet.animationSpeed = 0.05;
        pet.loop           = false;
        pet.gotoAndStop(0);
        self._transFrames     = null;
        self._transFrameIdx   = 0;
        self._transHoldFrames = 0;
      } else if (nextBucket === 'slow' && self._dragSpeedBucket === 'fast') {
        const seq = self._dragDirection > 0
          ? self.animations.heldRightTransition
          : self.animations.heldLeftTransition;
        self._transFrames     = seq;
        self._transFrameIdx   = 0;
        self._transHoldFrames = TRANSITION_HOLD;
        pet.textures       = seq;
        pet.animationSpeed = 0;
        pet.loop           = false;
        pet.gotoAndStop(0);
      } else if (nextBucket === 'fast') {
        self._transFrames     = null;
        self._transFrameIdx   = 0;
        self._transHoldFrames = 0;
        pet.textures       = self._dragDirection > 0
          ? self.animations.heldRightFast
          : self.animations.heldLeftFast;
        pet.animationSpeed = 0.05;
        pet.loop           = false;
        pet.gotoAndStop(0);
      }
    }
    self._dragSpeedBucket = nextBucket;

    self._prevPointerX = newX;
    self._prevPointerY = newY;
    self._lastPointerX = newX;
    self._lastPointerY = newY;
  });

  // --- pointer up (end drag → throw) ---
  const endDrag = (e) => {
    if (!self._isDragging) return;
    self._isDragging = false;

    const g  = e?.data?.global || e?.global || {};
    const gx = g.x || self._lastPointerX;
    const gy = g.y || self._lastPointerY;

    self._velocityX = (gx - self._lastPointerX) * 0.6;
    self._velocityY = (gy - self._lastPointerY) * 0.6;

    self._isFalling = true;
    self.state = 'falling';
    pet.textures       = self.animations.falling;
    pet.animationSpeed = 0.2;
    pet.loop           = true;       // prevent spurious onComplete on single-frame texture
    pet.onComplete     = null;       // clear any stale landing callback
    pet.play();
  };
  stage.on('pointerup',        endDrag);
  stage.on('pointerupoutside', endDrag);
}
