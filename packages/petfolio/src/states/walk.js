/**
 * states/walk.js — Walk, crawl, ceiling-crawl, and say-hi physics.
 *
 * Each function receives the Petfolio instance (`self`) so it can
 * read/write sprite position, scale, and call changeState().
 */
import {
  WALK_SPEED, CRAWL_SPEED, CRAWL_TOP_SPEED, EDGE_MARGIN,
  CEILING_Y_OFFSET,
  CRAWL_MOVE_FRAMES, CRAWL_PAUSE_FRAMES,
  CEILING_FALL_CHANCE, CEILING_EDGE_FALL_CHANCE,
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

// Freeze the crawl_top sprite on a single static pose. Used when the
// ceiling-crawling pet enters its PAUSE phase so the limbs don't keep
// cycling while the pet is meant to be holding still.
export function freezeCrawlTop(self) {
  self.sprite.gotoAndStop(0);
}

// Release the pet from the ceiling and trigger a gravity fall.
// Mirrors the wall-release pattern: clear crawl state, then drop.
export function releaseCeiling(self) {
  self._velocityX = 0;
  self._velocityY = 0;
  self._isFalling = false;
  self._ceilingPhaseFrames = 0;
  // Falling state plays the falling animation; idle below handles the rest.
  self.changeState('falling');
}

// Ceiling crawl — symmetric with wall grab:
//   1. CRAWL phase: pet moves left/right at CRAWL_TOP_SPEED, bouncing
//      off edges. Small chance per frame to release and fall.
//   2. PAUSE phase: pet holds still on the ceiling for a while.
//   3. RELEASE: when crawling hits an edge, there's a chance to fall
//      instead of bouncing. Also a small per-frame fall chance so the
//      pet doesn't stay on the ceiling forever.
export function updateCrawlTop(self) {
  const pet = self.sprite;
  snapToCeiling(self);

  // Tick the current phase
  if (self._ceilingPhaseFrames > 0) self._ceilingPhaseFrames--;

  if (self._ceilingPhaseIsCrawl) {
    // Move horizontally in the current crawl direction
    pet.x += self._ceilingCrawlDir * CRAWL_TOP_SPEED;

    // Random per-frame fall (so the pet can drop mid-crawl)
    if (Math.random() < CEILING_FALL_CHANCE) {
      releaseCeiling(self);
      return;
    }

    // Hit an edge — bounce or fall
    const hitLeft  = pet.x < EDGE_MARGIN;
    const hitRight = pet.x > window.innerWidth - EDGE_MARGIN;
    if (hitLeft || hitRight) {
      if (Math.random() < CEILING_EDGE_FALL_CHANCE) {
        releaseCeiling(self);
        return;
      }
      // Bounce: flip direction
      pet.x = hitLeft ? EDGE_MARGIN : window.innerWidth - EDGE_MARGIN;
      self._ceilingCrawlDir *= -1;
      pet.scale.x = (hitLeft ? -1 : 1) * Math.abs(pet.scale.x);
    }
  }

  // Phase expired → pick the next one. 60% chance of pausing after
  // a crawl, 40% chance of continuing in the same direction. After a
  // pause there's a 40% chance to reverse direction.
  if (self._ceilingPhaseFrames <= 0) {
    if (self._ceilingPhaseIsCrawl) {
      if (Math.random() < 0.6) {
        self._startCeilingPhase(false);            // pause
      } else {
        self._startCeilingPhase(true);             // keep crawling
      }
    } else {
      if (Math.random() < 0.4) self._ceilingCrawlDir *= -1;
      self._startCeilingPhase(true);
    }
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
