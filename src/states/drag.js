/**
 * states/drag.js — Drag, fall, and landing physics.
 */
import {
  GRAVITY, AIR_DRAG, EDGE_MARGIN, TRANSITION_HOLD,
  AIR_DRAG_Y,
} from '../constants.js';

// ── Drag (follow cursor) ────────────────────────────────────

export function updateDrag(self) {
  const pet = self.sprite;
  pet.x = self._lastPointerX + self._dragOffsetX;
  pet.y = self._lastPointerY + self._dragOffsetY;
  self._velocityX *= 0.9;
  self._velocityY *= 0.9;

  // Multi-frame transition (fast → slow ease-out)
  if (self._transFrames) {
    self._transHoldFrames--;
    if (self._transHoldFrames <= 0) {
      if (self._transFrameIdx < self._transFrames.length - 1) {
        self._transFrameIdx++;
        self._transHoldFrames = TRANSITION_HOLD;
        pet.gotoAndStop(self._transFrameIdx);
      } else {
        const stillSet = self._dragDirection > 0
          ? self.animations.heldRightStill
          : self.animations.heldLeftStill;
        pet.textures       = stillSet;
        pet.animationSpeed = 0.05;
        pet.loop           = false;
        pet.gotoAndStop(0);
        self._transFrames     = null;
        self._transFrameIdx   = 0;
        self._transHoldFrames = 0;
      }
    }
  }
}

// ── Fall (gravity + air drag) ───────────────────────────────

export function updateFall(self) {
  const pet = self.sprite;

  self._velocityY += GRAVITY;
  self._velocityY *= AIR_DRAG_Y;       // terminal-velocity feel on Y
  pet.x += self._velocityX;
  pet.y += self._velocityY;
  self._velocityX *= AIR_DRAG;

  // Clamp to window sides
  if (pet.x < EDGE_MARGIN) {
    pet.x = EDGE_MARGIN;
    self._velocityX = Math.abs(self._velocityX) * 0.5;
  }
  if (pet.x > window.innerWidth - EDGE_MARGIN) {
    pet.x = window.innerWidth - EDGE_MARGIN;
    self._velocityX = -Math.abs(self._velocityX) * 0.5;
  }

  // Floor collision — settle directly (no bounce)
  const floor = window.innerHeight;
  if (pet.y >= floor) {
    pet.y = floor;
    self._velocityX = 0;
    self._velocityY = 0;
    self._isFalling = false;
    playLanding(self);
  }
}

// ── Landing (one-shot impact sequence) ──────────────────────

export function playLanding(self) {
  const pet = self.sprite;
  pet.textures       = self.animations.land;
  pet.loop           = false;
  pet.animationSpeed = 0.15;
  pet.gotoAndPlay(0);

  // Pixi v6 uses the `onComplete` property callback — NOT the
  // EventEmitter `emit('complete')`. So we must assign the
  // callback directly instead of using `pet.on('complete', …)`.
  pet.onComplete = () => {
    pet.onComplete = null;             // clean up
    if (!self._isDragging && !self._isFalling) {
      pet.loop = true;
      if (self._autoEnabled) {
        // Auto-pilot picks a fresh random state — this already
        // bypasses any stale pre-drag state.
        self._scheduleNextTransition();
      } else {
        // User is in manual control: a drag-throw should never
        // snap back to wherever the pet was before (e.g. ceiling
        // crawl). Settle into idle so the pet "lands" naturally.
        self.changeState('idle');
      }
    }
  };
}
