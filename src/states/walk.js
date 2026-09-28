/**
 * states/walk.js — Walk, crawl, ceiling-crawl, and say-hi physics.
 *
 * Each function receives the MishiPet instance (`self`) so it can
 * read/write sprite position, scale, and call changeState().
 */
import {
  WALK_SPEED, CRAWL_SPEED, CRAWL_TOP_SPEED, EDGE_MARGIN,
  CEILING_Y_OFFSET,
  CRAWL_MOVE_FRAMES, CRAWL_PAUSE_FRAMES,
} from '../constants.js';

// ── Walking ─────────────────────────────────────────────────

export function updateWalkLeft(self) {
  self.sprite.scale.x = Math.abs(self.sprite.scale.x);
  self.sprite.x -= WALK_SPEED;
  if (self.sprite.x < EDGE_MARGIN) self.changeState('walk-right');
}

export function updateWalkRight(self) {
  self.sprite.scale.x = -Math.abs(self.sprite.scale.x);
  self.sprite.x += WALK_SPEED;
  if (self.sprite.x > window.innerWidth - EDGE_MARGIN) self.changeState('walk-left');
}

// ── Ground crawl (move-pause cycle) ──────────────────────────
//
// Each pose goes through a "move" sub-phase (pet slides at CRAWL_SPEED)
// then a "pause" sub-phase (pet stops, pose still up). When the sub-
// phases end, the pose flips to the other frame and the cycle repeats.
// The result: a creature-like step — momentum, then a settle, then
// another step, instead of a constant slide.

const CRAWL_STEP_LEN = CRAWL_MOVE_FRAMES + CRAWL_PAUSE_FRAMES; // frames per pose

export function updateCrawlLeft(self) {
  const pet = self.sprite;
  pet.scale.x = Math.abs(pet.scale.x);

  // Sub-phase within the current pose: 0..CRAWL_MOVE_FRAMES-1 = move,
  // CRAWL_MOVE_FRAMES..CRAWL_STEP_LEN-1 = pause.
  const inStepFrame = self._crawlHoldFrames ?? 0;
  if (inStepFrame < CRAWL_MOVE_FRAMES) {
    // MOVE phase: slide forward at CRAWL_SPEED
    pet.x -= CRAWL_SPEED;
  }
  // PAUSE phase: pet stays still (no x change)

  if (inStepFrame + 1 >= CRAWL_STEP_LEN) {
    // End of pose — flip frame, reset counter
    self._crawlFrameIdx   = (self._crawlFrameIdx + 1) % pet.textures.length;
    self._crawlHoldFrames = 0;
    pet.gotoAndStop(self._crawlFrameIdx);
  } else {
    self._crawlHoldFrames = inStepFrame + 1;
  }

  if (pet.x < EDGE_MARGIN) self.changeState('crawl-right');
}

export function updateCrawlRight(self) {
  const pet = self.sprite;
  pet.scale.x = -Math.abs(pet.scale.x);

  const inStepFrame = self._crawlHoldFrames ?? 0;
  if (inStepFrame < CRAWL_MOVE_FRAMES) {
    pet.x += CRAWL_SPEED;
  }

  if (inStepFrame + 1 >= CRAWL_STEP_LEN) {
    self._crawlFrameIdx   = (self._crawlFrameIdx + 1) % pet.textures.length;
    self._crawlHoldFrames = 0;
    pet.gotoAndStop(self._crawlFrameIdx);
  } else {
    self._crawlHoldFrames = inStepFrame + 1;
  }

  if (pet.x > window.innerWidth - EDGE_MARGIN) self.changeState('crawl-left');
}

// ── Ceiling crawl ───────────────────────────────────────────

export function snapToCeiling(self) {
  // Position the sprite so the bottom of the *drawn character* sits at y=0
  // (touching the ceiling). crawl_top frames have transparent padding below
  // the character, so the bottom-anchor y-coordinate needs to equal that
  // padding height (CEILING_Y_OFFSET px) multiplied by the sprite scale.
  self.sprite.y = Math.max(
    0,
    CEILING_Y_OFFSET * Math.abs(self.sprite.scale.y)
  );
}

export function updateCrawlTop(self) {
  const pet = self.sprite;
  snapToCeiling(self);

  // Continuous motion (frame cycling is handled by Pixi's animationSpeed)
  if (pet.scale.x > 0) {
    pet.x -= CRAWL_TOP_SPEED;
    if (pet.x < EDGE_MARGIN) pet.scale.x = -Math.abs(pet.scale.x);
  } else {
    pet.x += CRAWL_TOP_SPEED;
    if (pet.x > window.innerWidth - EDGE_MARGIN) pet.scale.x = Math.abs(pet.scale.x);
  }
}

// ── Say Hi (walk + wave) ────────────────────────────────────

export function updateSayHi(self) {
  const pet = self.sprite;
  if (pet.scale.x < 0) {
    pet.x += WALK_SPEED;
    if (pet.x > window.innerWidth - EDGE_MARGIN) pet.scale.x = Math.abs(pet.scale.x);
  } else {
    pet.x -= WALK_SPEED;
    if (pet.x < EDGE_MARGIN) pet.scale.x = -Math.abs(pet.scale.x);
  }
}
