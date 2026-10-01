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

// ── Ground crawl (move-pause-move-pause) ──────────────────────
// One crawl "step" has two phases:
//   MOVE  — pet slides at CRAWL_SPEED for this many frames
//   PAUSE — pet holds position for this many frames (pose still up)
// Then the pose flips to the other frame and the cycle repeats.
// Tweaking these gives the "crawling creature" feel — momentum +
// settle, instead of constant sliding.
export const CRAWL_MOVE_FRAMES     = 28;
export const CRAWL_PAUSE_FRAMES    = 22;
// One full step (move + pause + next step's move + next step's pause)
// lasts (MOVE_FRAMES + PAUSE_FRAMES) * 2 = 100 frames ≈ 1.67s at 60fps
// Note: ceiling crawl and wall crawl use continuous (non-stepped)
// motion — see states/walk.js updateCrawlTop and states/wall.js
// updateGrabRight.

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
export const CEILING_Y_OFFSET     = 70;    // px from sprite bottom-anchor to drawn character bottom
                                           // (compensates for transparent padding below the character
                                           // in crawl_top frames). Increase to push the pet down.
// Offset from frame's leading (wall-facing) edge to the drawn character's
// grabbing hand, in source pixels. The grab sprite (shime12-14) has the
// hand reaching to about x=25 of the 128px frame; we add the sprite's
// half-width (64) and subtract this to compute how far past the wall the
// anchor should sit. Increase to pull the pet AWAY from the wall, decrease
// to push the hand INTO the wall.
export const WALL_HAND_OFFSET     = 65;

// ── Auto-pilot timing ──────────────────────────────────────
export const AUTO_IDLE_MIN_MS     = 2000;  // min pause between random behaviors
export const AUTO_IDLE_MAX_MS     = 5000;  // max pause between random behaviors
export const AUTO_RESUME_DELAY_MS = 3000;  // delay after a user-invoked action before auto-pilot resumes

// ── Throw physics ────────────────────────────────────────────
export const VELOCITY_WINDOW_MS   = 80;     // pointer history window for throw velocity
export const VELOCITY_MIN_THRESH  = 1.2;    // px/frame below which we treat release as "drop in place"
export const AIR_DRAG_Y           = 0.985;  // per-frame multiplier on vy (terminal velocity feel)

// ── Jump-to-wall arc ────────────────────────────────────────
// JUMP_ARC_FRAMES is the *target* number of frames for the pet to
// travel from launch to wall impact. The horizontal velocity is set
// so the pet crosses the gap in exactly that many frames.
//
// JUMP_LAUNCH_VEL_Y is the initial upward velocity. The pet is in
// the air for ~2 * |vy| / gravity frames; this value is tuned so the
// total air time matches JUMP_ARC_FRAMES (with gravity 0.48 per frame
// used in wall.js, the matching launch velocity is approximately
// -0.48 * JUMP_ARC_FRAMES / 2).
//
//   JUMP_ARC_FRAMES = 70 → air time ≈ 67 frames (1.1s at 60fps)
//   vy_initial = -16       → apex ~260px above start
//
// Tuning tips:
//   - Lower JUMP_ARC_FRAMES  → faster, more aggressive jump
//   - More-negative vy_init  → higher arc (more hang time)
export const JUMP_ARC_FRAMES      = 70;
export const JUMP_LAUNCH_VEL_Y    = -16;    // initial upward velocity at launch
                                            // (less negative = lower arc, more negative = higher arc)

// ── Grab-on-throw transition ────────────────────────────────
// When the pet is thrown into the right wall with enough velocity,
// instead of an instant snap to grab-right, it eases into the grab
// position over this many frames. Lower = snappy snap, higher =
// slow slide-to-grip.
export const GRAB_SETTLE_FRAMES   = 12;

// ── Wall-crawl cadence ─────────────────────────────────────
// Once on the wall, the pet alternates between CRAWL (move up/down
// at WALK_SPEED) and PAUSE (hold still). Each phase lasts for a
// random duration in this range (frames). Gives the "creature
// resting on the wall" feel instead of constant bouncing.
export const WALL_CRAWL_MIN_FRAMES = 40;
export const WALL_CRAWL_MAX_FRAMES = 140;

// ── Ceiling-crawl cadence ───────────────────────────────────
// Same idea as the wall: alternate between CRAWL (move left/right at
// CRAWL_TOP_SPEED) and PAUSE (hold still) on the ceiling. Each phase
// lasts a random duration in this range (frames).
export const CEILING_CRAWL_MIN_FRAMES = 50;
export const CEILING_CRAWL_MAX_FRAMES = 180;

// ── Ceiling fall chance ─────────────────────────────────────
// While crawling on the ceiling, the pet has a small per-frame chance
// to release and drop. Higher = more frequent falls. 0 disables falls.
export const CEILING_FALL_CHANCE     = 0.0015;
// When the pet reaches the left/right edge of the window while on the
// ceiling, additional chance to release and drop instead of bouncing.
export const CEILING_EDGE_FALL_CHANCE = 0.35;

// ── Exit / peek ─────────────────────────────────────────────
// How far past the screen edge the avatar walks before snapping
// into the peek state. Larger = pet fully disappears before
// peeking back in. Keep small enough that the "walk off" feels
// quick (the user just clicked Exit).
export const EXIT_OFFSCREEN_OFFSET   = 80;     // px past the viewport edge
// Horizontal offset (positive value) of the peek-sprite's anchor
// from the viewport edge. With anchor (0.5, 1), this is how much
// of the sprite extends INTO the viewport from the edge:
//   visible width ≈ PEEK_INSET_H
// The rest of the sprite extends OUT of the viewport (clipped by
// the canvas). Set small for "just the head peeks" — try 30–50.
export const PEEK_INSET_H            = 66;     // px of sprite visible horizontally
// Vertical offset: how much of the sprite is visible above the viewport
// bottom (i.e. how much "peeks UP from behind the ground").
// The sprite's bottom anchor is pushed PEEK_INSET_V px BELOW the
// viewport bottom, so only the top portion of the sprite renders.
export const PEEK_INSET_V            = 120;     // px of sprite visible vertically
