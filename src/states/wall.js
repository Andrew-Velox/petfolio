/**
 * states/wall.js — Wall-grab, walk-to-grab, and jump-to-grab physics.
 */
import {
  WALK_SPEED, WALL_SNAP, GRAVITY, AIR_DRAG,
  WALL_HAND_OFFSET,
} from '../constants.js';

// X-coordinate for the sprite anchor so the grabbing hand sits flush
// against the right edge of the window. The grab sprite's hand reaches
// WALL_HAND_OFFSET px from the frame's leading edge; the anchor is at
// frame center (64px in a 128px frame), so the anchor sits this far
// past the wall edge. Reads the current sprite scale so it tracks
// per-instance scale overrides.
export const grabAnchorX = (self) => {
  const scale = Math.abs(self.sprite.scale.y) || 1;
  return window.innerWidth + (64 - WALL_HAND_OFFSET) * scale;
};

// Left-wall counterpart: the grab sprite is used un-mirrored for the
// left wall, so the hand reaches the same offset from the frame's
// leading (left) edge, and the anchor sits that far to the left of x=0.
export const grabAnchorXLeft = (self) => {
  const scale = Math.abs(self.sprite.scale.y) || 1;
  return -(64 - WALL_HAND_OFFSET) * scale;
};

// Freeze the grab sprite on a single static pose. Used when the
// wall-clinging pet enters its PAUSE phase so the legs/arms don't
// keep cycling while the pet is meant to be holding still.
export function freezeGrab(self) {
  const pet = self.sprite;
  pet.gotoAndStop(0);
}

// ── Walk to right wall, then grab ───────────────────────────

export function updateWalkGrabRight(self) {
  self.sprite.scale.x = -Math.abs(self.sprite.scale.x);
  self.sprite.x += WALK_SPEED;
  if (self.sprite.x > window.innerWidth - WALL_SNAP) {
    self.sprite.x = grabAnchorX(self);
    self.changeState('grab-right');
  }
}

// ── Walk to left wall, then grab ────────────────────────────

export function updateWalkGrabLeft(self) {
  self.sprite.scale.x = Math.abs(self.sprite.scale.x);
  self.sprite.x -= WALK_SPEED;
  if (self.sprite.x < WALL_SNAP) {
    self.sprite.x = grabAnchorXLeft(self);
    self.changeState('grab-left');
  }
}

// ── Jump to right wall (arc trajectory) ─────────────────────

export function updateJumpGrabRight(self) {
  const pet = self.sprite;

  // Apply gravity + horizontal velocity
  self._jumpVelY += GRAVITY * 0.8;
  pet.x += self._jumpVelX;
  pet.y += self._jumpVelY;

  // Reached the wall → grab it
  if (pet.x >= window.innerWidth - WALL_SNAP) {
    pet.x = grabAnchorX(self);
    pet.y = Math.max(80, Math.min(pet.y, window.innerHeight - 50));
    self._jumpVelX = 0;
    self._jumpVelY = 0;
    self.changeState('grab-right');
    return;
  }

  // Safety: if the pet hits the floor before reaching the wall,
  // just land normally instead of grabbing
  if (pet.y >= window.innerHeight) {
    pet.y = window.innerHeight;
    self._jumpVelX = 0;
    self._jumpVelY = 0;
    self.changeState('idle');
  }
}

// ── Jump to left wall (arc trajectory) ──────────────────────

export function updateJumpGrabLeft(self) {
  const pet = self.sprite;

  self._jumpVelY += GRAVITY * 0.8;
  pet.x -= self._jumpVelX;          // negative X velocity (toward left wall)
  pet.y += self._jumpVelY;

  if (pet.x <= WALL_SNAP) {
    pet.x = grabAnchorXLeft(self);
    pet.y = Math.max(80, Math.min(pet.y, window.innerHeight - 50));
    self._jumpVelX = 0;
    self._jumpVelY = 0;
    self.changeState('grab-left');
    return;
  }

  if (pet.y >= window.innerHeight) {
    pet.y = window.innerHeight;
    self._jumpVelX = 0;
    self._jumpVelY = 0;
    self.changeState('idle');
  }
}

// ── Wall grab / crawl (right wall) ──────────────────────────
//
// Three behaviours:
//   1. CRAWL phase: pet moves up/down at WALK_SPEED, reversing
//      direction at the top/bottom edges.
//   2. PAUSE phase: pet holds still on the wall for a while.
//   3. RELEASE: when crawling down reaches the floor, the pet
//      detaches and lands; when crawling up reaches the top
//      (y <= 80), it transitions to ceiling crawl.

export function updateGrabRight(self) {
  const pet = self.sprite;
  pet.x = grabAnchorX(self);

  // Tick the current phase
  if (self._wallPhaseFrames > 0) self._wallPhaseFrames--;

  if (self._wallPhaseIsCrawl) {
    if (self._wallCrawlDir > 0) {
      pet.y += WALK_SPEED;
      // Reached the floor — release wall, walk a bit, then auto-pilot
      if (pet.y >= window.innerHeight) {
        pet.y = window.innerHeight;
        self._velocityX = 0;
        self._velocityY = 0;
        self._isFalling = false;
        self._wallPhaseFrames = 0;
        // Walk away from the wall — right wall → walk left, left wall → walk right
        const walkDir = self.state === 'grab-right' ? 'walk-left' : 'walk-right';
        self.triggerState(walkDir);
        return;
      }
    } else {
      pet.y -= WALK_SPEED;
      // Reached the ceiling — release to ceiling crawl
      if (pet.y <= 80) {
        pet.y = 80;
        self._wallPhaseFrames = 0;
        self._lastWallWas = self.state;   // remember origin for ceiling entry
        self.changeState('crawl_top');
        return;
      }
    }
  }

  // Phase expired → pick the next one. 60% chance of pausing after
  // a crawl, 40% chance of continuing in a new direction.
  if (self._wallPhaseFrames <= 0) {
    if (self._wallPhaseIsCrawl) {
      if (Math.random() < 0.6) {
        self._startWallPhase(false);            // pause
      } else {
        self._wallCrawlDir *= -1;               // reverse direction
        self._startWallPhase(true);
      }
    } else {
      // Paused — start crawling again (40% reverse, 60% continue)
      if (Math.random() < 0.4) self._wallCrawlDir *= -1;
      self._startWallPhase(true);
    }
  }
}

// ── Wall grab / crawl (left wall) ───────────────────────────
//
// Mirror of updateGrabRight: same phase/release logic, but anchored
// to the left wall.

export function updateGrabLeft(self) {
  const pet = self.sprite;
  pet.x = grabAnchorXLeft(self);

  if (self._wallPhaseFrames > 0) self._wallPhaseFrames--;

  if (self._wallPhaseIsCrawl) {
    if (self._wallCrawlDir > 0) {
      pet.y += WALK_SPEED;
      if (pet.y >= window.innerHeight) {
        pet.y = window.innerHeight;
        self._velocityX = 0;
        self._velocityY = 0;
        self._isFalling = false;
        self._wallPhaseFrames = 0;
        // Walk away from the wall — left wall → walk right
        const walkDir = self.state === 'grab-right' ? 'walk-left' : 'walk-right';
        self.triggerState(walkDir);
        return;
      }
    } else {
      pet.y -= WALK_SPEED;
      if (pet.y <= 80) {
        pet.y = 80;
        self._wallPhaseFrames = 0;
        self._lastWallWas = self.state;   // remember origin for ceiling entry
        self.changeState('crawl_top');
        return;
      }
    }
  }

  if (self._wallPhaseFrames <= 0) {
    if (self._wallPhaseIsCrawl) {
      if (Math.random() < 0.6) {
        self._startWallPhase(false);
      } else {
        self._wallCrawlDir *= -1;
        self._startWallPhase(true);
      }
    } else {
      if (Math.random() < 0.4) self._wallCrawlDir *= -1;
      self._startWallPhase(true);
    }
  }
}
