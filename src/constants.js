/**
 * constants.js — All physics and timing constants.
 *
 * Centralised so every module shares the same tuning values.
 * Tweak numbers here — no need to hunt through multiple files.
 */

// ── Movement speeds ─────────────────────────────────────────
export const WALK_SPEED           = 2.0;
export const CRAWL_SPEED          = 0.8;
export const CRAWL_TOP_SPEED      = 1.0;

// ── Gravity / air ───────────────────────────────────────────
export const GRAVITY              = 0.6;   // px / frame²
export const AIR_DRAG             = 0.94;

// ── Drag interaction ────────────────────────────────────────
export const DRAG_SPEED_THRESHOLD = 3;     // px between pointermove events
export const TRANSITION_HOLD      = 5;     // frames to hold each ease-out step

// ── Layout ──────────────────────────────────────────────────
export const EDGE_MARGIN          = 50;    // px inset from window edges
export const WALL_SNAP            = 40;    // px inset for wall-grab snap
export const SPRITE_SCALE         = 0.95;

// ── Auto-pilot timing ──────────────────────────────────────
export const AUTO_IDLE_MIN_MS     = 2000;  // min pause between random behaviors
export const AUTO_IDLE_MAX_MS     = 5000;  // max pause between random behaviors
