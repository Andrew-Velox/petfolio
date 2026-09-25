/**
 * transitions.js — State transition table for auto-pilot.
 *
 * Each state maps to:
 *   next:     array of allowed follow-up states (picked randomly)
 *   duration: how long (ms) to stay in this state before transitioning
 *
 * When the auto-pilot timer fires, it looks up the CURRENT state
 * (which may have changed via physics, e.g. walk-grab → grab),
 * picks a random entry from `next`, and transitions.
 *
 * States not listed here have no auto-transitions — they either
 * have physics that auto-transitions (jump-grab-right → grab-right)
 * or are transient (held, falling, land).
 */

export const STATE_TRANSITIONS = {
  // ── Ground states ─────────────────────────────────────────
  idle: {
    next: ['walk-right', 'walk-left', 'jump-grab-right', 'sit',
           'say_hi', 'wave', 'tv_clone', 'crawl-right', 'crawl-left'],
    duration: 2000,
  },

  'walk-right': {
    next: ['idle', 'sit', 'say_hi', 'wave', 'crawl-right', 'jump-grab-right'],
    duration: 3500,
  },

  'walk-left': {
    next: ['idle', 'sit', 'say_hi', 'wave', 'crawl-left', 'jump-grab-right'],
    duration: 3500,
  },

  sit: {
    next: ['remove_cap', 'idle', 'jump-grab-right'],
    duration: 3500,
  },

  say_hi: {
    next: ['idle', 'walk-right', 'walk-left', 'sit', 'wave'],
    duration: 3000,
  },

  wave: {
    next: ['idle', 'walk-right', 'walk-left', 'sit'],
    duration: 3000,
  },

  tv_clone: {
    next: ['idle', 'wave', 'say_hi', 'walk-right', 'walk-left'],
    duration: 4000,
  },

  remove_cap: {
    next: ['idle', 'sit', 'walk-right'],
    duration: 4000,
  },

  // ── Crawl (ground) ───────────────────────────────────────
  'crawl-right': {
    next: ['idle', 'sit', 'wave', 'crawl-left'],
    duration: 3500,
  },

  'crawl-left': {
    next: ['idle', 'sit', 'wave', 'crawl-right'],
    duration: 3500,
  },

  // ── Wall / ceiling ───────────────────────────────────────
  // walk-grab-right auto-transitions to grab-right via physics
  // so we just give it enough time to cross the screen.
  'walk-grab-right': {
    next: ['grab-right'],
    duration: 10000,
  },

  // jump-grab-right auto-transitions to grab-right via physics
  // so we just give it enough time for the arc.
  'jump-grab-right': {
    next: ['grab-right'],
    duration: 5000,
  },

  'grab-right': {
    next: ['crawl_top', 'idle'],
    duration: 5000,
  },

  crawl_top: {
    next: ['idle'],           // idle triggers gravity fall from ceiling
    duration: 5000,
  },

  // ── Summon (handled specially — only plays once) ──────────
  summon: {
    next: ['idle'],
    duration: 5000,
  },
};
