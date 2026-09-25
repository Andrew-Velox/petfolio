/**
 * states/walk.js — Walk, crawl, ceiling-crawl, and say-hi physics.
 *
 * Each function receives the MishiPet instance (`self`) so it can
 * read/write sprite position, scale, and call changeState().
 */
import {
  WALK_SPEED, CRAWL_SPEED, CRAWL_TOP_SPEED, EDGE_MARGIN,
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

// ── Ground crawl ────────────────────────────────────────────

export function updateCrawlLeft(self) {
  self.sprite.scale.x = Math.abs(self.sprite.scale.x);
  self.sprite.x -= CRAWL_SPEED;
  if (self.sprite.x < EDGE_MARGIN) self.changeState('crawl-right');
}

export function updateCrawlRight(self) {
  self.sprite.scale.x = -Math.abs(self.sprite.scale.x);
  self.sprite.x += CRAWL_SPEED;
  if (self.sprite.x > window.innerWidth - EDGE_MARGIN) self.changeState('crawl-left');
}

// ── Ceiling crawl ───────────────────────────────────────────

export function snapToCeiling(self) {
  const srcH = self.animations.crawl_top[0]?.height || 128;
  self.sprite.y = srcH * Math.abs(self.sprite.scale.y);
}

export function updateCrawlTop(self) {
  const pet = self.sprite;
  snapToCeiling(self);

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
