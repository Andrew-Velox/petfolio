/**
 * states/wall.js — Wall-grab, walk-to-grab, and jump-to-grab physics.
 */
import { WALK_SPEED, WALL_SNAP, GRAVITY, AIR_DRAG } from '../constants.js';

// ── Walk to right wall, then grab ───────────────────────────

export function updateWalkGrabRight(self) {
  self.sprite.scale.x = -Math.abs(self.sprite.scale.x);
  self.sprite.x += WALK_SPEED;
  if (self.sprite.x > window.innerWidth - WALL_SNAP) {
    self.sprite.x = window.innerWidth - WALL_SNAP;
    self.changeState('grab-right');
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
    pet.x = window.innerWidth - WALL_SNAP;
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

// ── Wall grab / crawl (right wall) ──────────────────────────

export function updateGrabRight(self) {
  const pet = self.sprite;
  pet.x = window.innerWidth - WALL_SNAP;

  if (self._wallCrawlDir > 0) {
    pet.y += WALK_SPEED;
    if (pet.y >= window.innerHeight) {
      pet.y = window.innerHeight;
      self._wallCrawlDir = -1;
    }
  } else {
    pet.y -= WALK_SPEED;
    if (pet.y <= 80) {
      pet.y = 80;
      self._wallCrawlDir = 1;
    }
  }
}
