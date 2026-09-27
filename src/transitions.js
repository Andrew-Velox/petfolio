/**
 * transitions.js — State transition table for auto-pilot.
 *
 * Each state maps to:
 *   next:  array of allowed follow-up states (picked randomly)
 *   type:  'loop'  → plays in a loop for a random duration, then transitions
 *          'once'  → plays ALL frames once, then transitions automatically
 *
 * For 'loop' states:
 *   minMs / maxMs — random duration range (milliseconds)
 *
 * For 'once' states:
 *   no duration needed — waits for the animation to finish via onComplete.
 */

export const STATE_TRANSITIONS = {
  // ═══════════════════════════════════════════════════════════
  // LOOP states — random duration, keep looping until timer
  // ═══════════════════════════════════════════════════════════

  idle: {
    next:  ['walk-right', 'walk-left', 'jump-grab-right', 'sit',
            'say_hi', 'wave', 'tv_clone', 'crawl-right', 'crawl-left'],
    type:  'loop',
    minMs: 3000,
    maxMs: 6000,
  },

  'walk-right': {
    next:  ['idle', 'sit', 'say_hi', 'wave', 'crawl-right', 'jump-grab-right'],
    type:  'loop',
    minMs: 5000,
    maxMs: 9000,
  },

  'walk-left': {
    next:  ['idle', 'sit', 'say_hi', 'wave', 'crawl-left', 'jump-grab-right'],
    type:  'loop',
    minMs: 5000,
    maxMs: 9000,
  },

  sit: {
    next:  ['remove_cap', 'idle', 'jump-grab-right'],
    type:  'loop',
    minMs: 4000,
    maxMs: 8000,
  },

  say_hi: {
    next:  ['idle', 'walk-right', 'walk-left', 'sit', 'wave'],
    type:  'loop',
    minMs: 4000,
    maxMs: 7000,
  },

  wave: {
    next:  ['idle', 'walk-right', 'walk-left', 'sit'],
    type:  'loop',
    minMs: 4000,
    maxMs: 7000,
  },

  // ── Crawl (ground) ───────────────────────────────────────
  'crawl-right': {
    next:  ['idle', 'sit', 'wave', 'crawl-left'],
    type:  'loop',
    minMs: 5000,
    maxMs: 9000,
  },

  'crawl-left': {
    next:  ['idle', 'sit', 'wave', 'crawl-right'],
    type:  'loop',
    minMs: 5000,
    maxMs: 9000,
  },

  // ── Wall / ceiling (loop — random time on wall) ──────────
  'walk-grab-right': {
    next:  ['grab-right'],
    type:  'loop',
    minMs: 8000,
    maxMs: 10000,
  },

  'jump-grab-right': {
    next:  ['grab-right'],
    type:  'loop',
    minMs: 3000,
    maxMs: 5000,
  },

  'grab-right': {
    next:  ['crawl_top', 'idle'],
    type:  'loop',
    minMs: 3000,
    maxMs: 6000,
  },

  crawl_top: {
    next:  ['idle'],           // idle triggers gravity fall from ceiling
    type:  'loop',
    minMs: 3000,
    maxMs: 6000,
  },

  // ═══════════════════════════════════════════════════════════
  // ONCE states — play all frames, then transition
  // ═══════════════════════════════════════════════════════════

  tv_clone: {
    next: ['idle', 'wave', 'say_hi', 'walk-right', 'walk-left'],
    type: 'once',
  },

  remove_cap: {
    next: ['idle', 'sit', 'walk-right'],
    type: 'once',
  },

  summon: {
    next: ['idle'],
    type: 'once',
  },
};
