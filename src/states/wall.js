/**
 * states/wall.js — Wall-grab and walk-to-grab physics.
 */
import { WALK_SPEED, WALL_SNAP } from '../constants.js';

// ── Walk to right wall, then grab ───────────────────────────

export function updateWalkGrabRight(self) {
  self.sprite.scale.x = -Math.abs(self.sprite.scale.x);
  self.sprite.x += WALK_SPEED;
  if (self.sprite.x > window.innerWidth - WALL_SNAP) {
    self.sprite.x = window.innerWidth - WALL_SNAP;
    self.changeState('grab-right');
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
