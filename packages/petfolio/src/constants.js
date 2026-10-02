/**
 * constants.js — Rendering and host-side tuning values.
 *
 * Movement physics and timing live in the Shimeji engine (src/engine/);
 * its numbers (walk speed, jump velocity, gravity, durations …) are the
 * original Shimeji values in shime-config.js / actions.js.
 */

// ── Rendering ───────────────────────────────────────────────
export const SPRITE_SCALE   = 0.95;
export const FRAME_SIZE     = 128;   // source sprite size (px); Shimeji image sets are 128×128
// Draw positions interpolated between 25 fps engine ticks so motion looks
// smooth on 60/120/144 Hz displays. Poses still change at the engine rate.
export const SMOOTH_RENDER  = true;
export const SMOOTH_MAX_JUMP = 48;   // px; bigger jumps are teleports (wall→ceiling…), never smoothed

// ── Auto-pilot ──────────────────────────────────────────────
// After a user-invoked action (menu, drag-throw) auto-pilot resumes
// following this delay, even if it was previously off.
export const AUTO_RESUME_DELAY_MS = 3000;
// Multiplier for Shimeji's long idle periods (Stand / Sit / Sprawl /
// holding a wall: 20–60 s). 1 = original Shimeji. Try 0.3 for a livelier pet.
export const IDLE_DURATION_SCALE  = 1;

// ── Exit / peek ─────────────────────────────────────────────
// How far past the screen edge the avatar walks before it freezes
// into the peek pose.
export const EXIT_OFFSCREEN_OFFSET = 80;   // px past the viewport edge
// With the anchor at bottom-centre, these push the sprite past the edge /
// below the viewport so only this much of it stays visible ("head peeking").
export const PEEK_INSET_H = 66;            // px of sprite visible horizontally
export const PEEK_INSET_V = 120;           // px of sprite visible vertically
