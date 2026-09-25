/**
 * behaviors.js — Behavior chains for auto-pilot.
 *
 * Each chain is an array of steps: { state, duration }.
 * The auto-pilot picks a random chain, walks through each step,
 * then idles before picking the next.
 *
 * To add a new behavior: append an entry here. The state must
 * already be handled by changeState() + the tick dispatcher.
 */

export const BEHAVIOR_CHAINS = [
  // ── Simple ground behaviors ───────────────────────────────
  {
    name: 'walk-around',
    steps: [
      { state: 'walk-right', duration: 3000 },
      { state: 'walk-left',  duration: 3000 },
    ],
  },
  {
    name: 'sit-and-rest',
    steps: [
      { state: 'sit', duration: 4000 },
    ],
  },
  {
    name: 'crawl-around',
    steps: [
      { state: 'crawl-right', duration: 3500 },
      { state: 'crawl-left',  duration: 3500 },
    ],
  },
  {
    name: 'say-hello',
    steps: [
      { state: 'say_hi', duration: 3000 },
    ],
  },
  {
    name: 'wave-hello',
    steps: [
      { state: 'wave', duration: 3000 },
    ],
  },

  // ── Wall grab → crawl on wall ─────────────────────────────
  {
    name: 'wall-grab',
    steps: [
      { state: 'walk-grab-right', duration: 4000 },
      { state: 'grab-right',      duration: 5000 },
      { state: 'sit',             duration: 2000 },
    ],
  },

  // ── Full ceiling crawl sequence ───────────────────────────
  {
    name: 'ceiling-adventure',
    steps: [
      { state: 'walk-grab-right', duration: 4000 },
      { state: 'grab-right',      duration: 3000 },
      { state: 'crawl_top',       duration: 5000 },
      { state: 'sit',             duration: 2000 },
    ],
  },

  // ── Summon entrance ───────────────────────────────────────
  {
    name: 'summon-entrance',
    steps: [
      { state: 'summon', duration: 5000 },
    ],
  },

  // ── Leisurely stroll ──────────────────────────────────────
  {
    name: 'long-walk',
    steps: [
      { state: 'walk-left',  duration: 5000 },
      { state: 'sit',        duration: 2000 },
      { state: 'walk-right', duration: 5000 },
    ],
  },

  // ── Crawl then wave ───────────────────────────────────────
  {
    name: 'crawl-and-wave',
    steps: [
      { state: 'crawl-right', duration: 2500 },
      { state: 'wave',        duration: 3000 },
      { state: 'crawl-left',  duration: 2500 },
    ],
  },

  // ── Remove cap → sit ──────────────────────────────────────
  {
    name: 'remove-cap-and-sit',
    steps: [
      { state: 'remove_cap', duration: 4000 },
      { state: 'sit',        duration: 3000 },
    ],
  },

  // ── TV Clone combos ───────────────────────────────────────
  {
    name: 'tv-clone-wave',
    steps: [
      { state: 'wave', duration: 3000 },
      { state: 'tv_clone',     duration: 4000 },
    ],
  },
  {
    name: 'tv-clone-say-hi',
    steps: [
      { state: 'say_hi',   duration: 3000 },
      { state: 'tv_clone', duration: 4000 },
    ],
  },
  {
    name: 'tv-clone-walk',
    steps: [
      { state: 'walk-right',  duration: 3000 },
      { state: 'tv_clone',   duration: 4000 },
      { state: 'walk-left',   duration: 3000 },
    ],
  },
];
