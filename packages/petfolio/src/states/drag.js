/**
 * states/drag.js — Drag, fall, and landing physics.
 */
import {
  GRAVITY, AIR_DRAG, EDGE_MARGIN, TRANSITION_HOLD,
  AIR_DRAG_Y, GRAB_SETTLE_FRAMES,
} from '../constants.js';
import { grabAnchorX, grabAnchorXLeft } from './wall.js';

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

  // ── Grab-settle sub-phase ─────────────────────────────
  // After a throw into a wall, ease the pet horizontally toward
  // the grab anchor over GRAB_SETTLE_FRAMES, then transition to
  // grab-right or grab-left. Skips gravity/velocity for clean
  // slide motion. We use _grabSettleTarget so the direction is
  // captured at impact, not recomputed from current state.
  if (self._grabSettleFrames > 0) {
    const target = self._grabSettleTarget ?? grabAnchorX(self);
    pet.x += (target - pet.x) / self._grabSettleFrames;
    self._grabSettleFrames--;
    if (self._grabSettleFrames <= 0) {
      pet.x = target;
      self._isFalling = false;
      const nextState = self._grabSettleTarget === grabAnchorXLeft(self) ? 'grab-left' : 'grab-right';
      self._grabSettleTarget = null;
      self.changeState(nextState);
    }
    return;
  }

  self._velocityY += GRAVITY;
  self._velocityY *= AIR_DRAG_Y;       // terminal-velocity feel on Y
  pet.x += self._velocityX;
  pet.y += self._velocityY;
  self._velocityX *= AIR_DRAG;

  // Clamp to window sides. If the pet is being thrown into a wall
  // with meaningful horizontal velocity, start the grab-settle
  // (slow slide into grip) instead of bouncing off.
  if (pet.x < EDGE_MARGIN) {
    pet.x = EDGE_MARGIN;
    // Thrown into the left wall with intent → settle into grab-left.
    if (self._velocityX < -1.5 && self.state === 'falling') {
      self._velocityX = 0;
      self._velocityY = 0;
      self._grabSettleTarget  = grabAnchorXLeft(self);
      self._grabSettleFrames  = GRAB_SETTLE_FRAMES;
      return;
    }
    self._velocityX = Math.abs(self._velocityX) * 0.5;
  }
  if (pet.x > window.innerWidth - EDGE_MARGIN) {
    pet.x = window.innerWidth - EDGE_MARGIN;
    // Thrown into the right wall with intent → settle into grab-right.
    if (self._velocityX > 1.5 && self.state === 'falling') {
      self._velocityX = 0;
      self._velocityY = 0;
      self._grabSettleTarget  = grabAnchorX(self);
      self._grabSettleFrames  = GRAB_SETTLE_FRAMES;
      return;
    }
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

  // Reset the sprite cleanly before switching textures. Pixi v6's
  // AnimatedSprite can get stuck on the previous (single-frame)
  // falling texture if we just reassign `textures` and call
  // gotoAndPlay — the internal _currentFrame / _durations state
  // sometimes isn't fully re-initialised, leaving the old sprite
  // displayed forever. Stop first, then assign, then play.
  pet.stop();
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
