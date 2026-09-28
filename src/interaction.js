/**
 * interaction.js — Pointer drag / throw wiring.
 *
 * Sets up pointerdown, pointermove, pointerup on the sprite and stage.
 * All handlers close over the MishiPet instance (`self`).
 */
import * as PIXI from 'pixi.js';
import {
  DRAG_SPEED_THRESHOLD, TRANSITION_HOLD,
  VELOCITY_WINDOW_MS, VELOCITY_MIN_THRESH,
} from './constants.js';

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
    // Only left-button starts a drag. Right/middle clicks are handled
    // elsewhere (e.g. main.js opens the context menu on rightclick).
    const button = e.button ?? e.data?.button ?? 0;
    if (button !== 0) return;

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

    // Seed pointer history for throw-velocity tracking
    self._pointerHistory = [{ t: performance.now(), x: self._lastPointerX, y: self._lastPointerY }];
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

    // Append to pointer-history ring buffer for throw velocity.
    // Drop samples older than VELOCITY_WINDOW_MS so a slow drag
    // doesn't get averaged out by stale positions.
    const now = performance.now();
    self._pointerHistory.push({ t: now, x: newX, y: newY });
    while (
      self._pointerHistory.length > 1
      && now - self._pointerHistory[0].t > VELOCITY_WINDOW_MS
    ) {
      self._pointerHistory.shift();
    }
  });

  // --- pointer up (end drag → throw) ---
  const endDrag = (e) => {
    if (!self._isDragging) return;
    self._isDragging = false;

    const g  = e?.data?.global || e?.global || {};
    const gx = g.x || self._lastPointerX;
    const gy = g.y || self._lastPointerY;

    // Append the release point so the very last sample is included
    self._pointerHistory.push({ t: performance.now(), x: gx, y: gy });

    // Compute release velocity from the time-windowed pointer history.
    // Average velocity = (newest.pos - oldest.pos) / frame-count, where
    // frame-count is the elapsed ms normalised to 60fps frames.
    let vx = 0;
    let vy = 0;
    const hist = self._pointerHistory;
    if (hist.length >= 2) {
      const oldest = hist[0];
      const newest = hist[hist.length - 1];
      const dtFrames = (newest.t - oldest.t) / (1000 / 60);
      if (dtFrames >= 1) {
        vx = (newest.x - oldest.x) / dtFrames;
        vy = (newest.y - oldest.y) / dtFrames;
      }
    }

    // Clamp to a sane max so a wild flick doesn't yeet the pet offscreen
    const MAX_V = 25;
    vx = Math.max(-MAX_V, Math.min(MAX_V, vx));
    vy = Math.max(-MAX_V, Math.min(MAX_V, vy));

    // Below threshold: treat as intentional placement, not a throw
    if (Math.hypot(vx, vy) < VELOCITY_MIN_THRESH) {
      vx = 0;
      vy = 0;
    }

    self._velocityX = vx;
    self._velocityY = vy;

    self._isFalling = true;
    self.state = 'falling';
    pet.textures       = self.animations.falling;
    pet.animationSpeed = 0.2;
    pet.loop           = true;       // prevent spurious onComplete on single-frame texture
    pet.onComplete     = null;       // clear any stale landing callback
    pet.play();

    // A drag-throw is a user action — schedule auto-resume so the
    // pet doesn't just sit in idle after landing.
    self._scheduleAutoResume();
  };
  stage.on('pointerup',        endDrag);
  stage.on('pointerupoutside', endDrag);
}
