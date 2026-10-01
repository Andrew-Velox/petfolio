/**
 * Petfolio.js — Slim orchestrator class.
 *
 * All heavy logic lives in dedicated modules:
 *   constants.js   — tuning values
 *   animations.js  — frame mappings
 *   behaviors.js   — auto-pilot chains
 *   bubble.js      — speech-bubble factory
 *   interaction.js — drag / throw pointer wiring
 *   states/walk.js — walk, crawl, ceiling, say-hi physics
 *   states/wall.js — wall-grab physics
 *   states/drag.js — drag, fall, landing physics
 *   states/summon.js — summon drop physics
 *
 * Usage:
 *   import { Petfolio } from './Petfolio.js';
 *   const pet = new Petfolio(document.getElementById('canvas'));
 */
import * as PIXI from 'pixi.js';

// ── Config & data ───────────────────────────────────────────
import {
  SPRITE_SCALE, WALL_SNAP,
  AUTO_IDLE_MIN_MS, AUTO_IDLE_MAX_MS, AUTO_RESUME_DELAY_MS,
  JUMP_ARC_FRAMES, JUMP_LAUNCH_VEL_Y,
  WALL_CRAWL_MIN_FRAMES, WALL_CRAWL_MAX_FRAMES,
  CEILING_CRAWL_MIN_FRAMES, CEILING_CRAWL_MAX_FRAMES,
  CEILING_FALL_CHANCE, CEILING_EDGE_FALL_CHANCE,
  PEEK_INSET_H, PEEK_INSET_V,
} from './constants.js';
import { buildAnimations }     from './animations.js';
import { STATE_TRANSITIONS }   from './transitions.js';
import { makeBubble }          from './bubble.js';
import { initInteraction }   from './interaction.js';

// ── State physics ───────────────────────────────────────────
import {
  updateWalkLeft, updateWalkRight,
  updateWalkOffLeft, updateWalkOffRight,
  updateCrawlLeft, updateCrawlRight,
  updateCrawlTop, updateSayHi,
  snapToCeiling, freezeCrawlTop,
} from './states/walk.js';
import { updateWalkGrabRight, updateWalkGrabLeft, updateJumpGrabRight, updateJumpGrabLeft, updateGrabRight, updateGrabLeft, freezeGrab } from './states/wall.js';
import { updateDrag, updateFall }               from './states/drag.js';
import { updateSummon }                         from './states/summon.js';

// ─────────────────────────────────────────────────────────────
// Petfolio class
// ─────────────────────────────────────────────────────────────
export class Petfolio {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object}            [opts]
   * @param {string}            [opts.spriteDir='/sprites/']
   */
  constructor(canvas, opts = {}) {
    const spriteDir = opts.spriteDir ?? '/sprites/';

    // ── Pixi bootstrap ──────────────────────────────────────
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

    this.app = new PIXI.Application({
      view:        canvas,
      resizeTo:    window,
      transparent: true,
    });

    // ── Animations ──────────────────────────────────────────
    this.animations = buildAnimations(spriteDir);

    // ── Animated sprite ─────────────────────────────────────
    this.sprite = new PIXI.AnimatedSprite(this.animations.idle);
    this.sprite.anchor.set(0.5, 1);
    this.sprite.x = window.innerWidth / 2;
    this.sprite.y = window.innerHeight / 2 + 100;
    this.sprite.scale.set(SPRITE_SCALE);
    this.sprite.animationSpeed = 0.15;
    this.sprite.play();
    this.app.stage.addChild(this.sprite);

    // ── Speech bubbles ──────────────────────────────────────
    this.bubble = makeBubble(this.sprite, 'Hi!', {
      mirrorOnFacing: true,
      sideOffset:     0,
      offsetYExtra:   -55,
    });
    this.waveBubble = makeBubble(this.sprite, 'Wave!', {
      mirrorOnFacing: false,
      sideOffset:     40,
      offsetYExtra:   20,
      showPointer:    true,
    });
    this.app.stage.addChild(this.bubble.container);
    this.app.stage.addChild(this.waveBubble.container);

    // ── State machine ───────────────────────────────────────
    this.state         = 'idle';
    this.previousState = 'idle';

    // ── Physics / interaction vars ──────────────────────────
    this._isDragging        = false;
    this._isFalling         = false;
    this._velocityX         = 0;
    this._velocityY         = 0;
    this._dragOffsetX       = 0;
    this._dragOffsetY       = 0;
    this._lastPointerX      = 0;
    this._lastPointerY      = 0;
    this._prevPointerX      = 0;
    this._prevPointerY      = 0;
    this._pointerHistory    = [];          // ring buffer of {t, x, y} for throw velocity
    this._dragDirection     = 0;
    this._dragSpeedBucket   = 'slow';
    this._transFrames       = null;
    this._transFrameIdx     = 0;
    this._transHoldFrames   = 0;
    this._wallCrawlDir      = 1;
    this._summonFalling     = false;
    this._summonFallVel     = 0;
    this._summonStage       = null;
    this._jumpVelX          = 0;      // horizontal speed during jump-to-wall
    this._jumpVelY          = 0;      // vertical speed during jump-to-wall
    this._crawlFrameIdx     = 0;      // current frame in crawl/crawl_top ping-pong
    this._crawlHoldFrames   = 0;      // frames remaining before next step advance
    this._grabSettleFrames  = 0;      // frames left in grab-on-throw slide-to-grip
    this._grabSettleTarget  = null;   // x-coordinate to ease into during grab settle
    this._wallPhaseFrames   = 0;      // frames remaining in current wall phase (crawl or pause)
    this._wallPhaseIsCrawl  = true;   // true = crawling, false = paused on the wall
    this._ceilingPhaseFrames   = 0;   // frames remaining in current ceiling phase (crawl or pause)
    this._ceilingPhaseIsCrawl  = true; // true = crawling on ceiling, false = paused
    this._ceilingCrawlDir      = 1;   // +1 = right, -1 = left (current ceiling travel direction)
    this._lastWallWas          = null; // 'grab-right' | 'grab-left' | null — used to pick the
                                       // initial facing direction when entering crawl_top

    // ── Auto-pilot ──────────────────────────────────────────
    this._autoEnabled       = false;
    this._autoTimer         = null;
    this._lastAutoState     = null;   // avoid repeating same state
    this._summonUsed        = false;  // summon entrance plays only once
    this._autoResumeTimer   = null;   // timer that re-enables auto after user actions

    // ── Exit / peek ─────────────────────────────────────────
    this._isPeeking         = false;   // true while sprite is at peek position (frozen)
    this._peekSide          = null;    // 'left' | 'right' | null
    this._lastPeekSide      = null;    // remembered so startAuto() can place sprite back correctly

    // ── Wire up input & start loop ──────────────────────────
    initInteraction(this);
    this.app.ticker.add(this._tick, this);
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — State transitions
  // ═══════════════════════════════════════════════════════════

  changeState(newState) {
    const pet   = this.sprite;
    const anims = this.animations;

    // Cancel in-flight drag / fall
    if (this._isDragging || this._isFalling) {
      this._isDragging = false;
      this._isFalling  = false;
      this._velocityX  = 0;
      this._velocityY  = 0;
    }

    // Cancel in-flight summon
    this._summonFalling = false;
    this._summonFallVel = 0;
    this._summonStage   = null;

    // Hide bubbles by default
    this.bubble.hide();
    this.waveBubble.hide();

    // Don't restore to transient states
    if (['held', 'falling', 'land'].includes(newState)) {
      newState = 'idle';
    }

    // If leaving a ceiling/wall state, trigger a gravity fall
    // (but not when jumping to the wall — that has its own arc)
    if (newState !== 'crawl_top'
     && newState !== 'grab-right'  && newState !== 'jump-grab-right'
     && newState !== 'grab-left'   && newState !== 'jump-grab-left') {
      if (pet.y < window.innerHeight - 50) {
        // Pet is mid-air — drop it with gravity instead of teleporting
        this._isFalling = true;
        this._velocityX = 0;
        this._velocityY = 0;
        pet.textures       = this.animations.falling;
        pet.animationSpeed = 0.2;
        pet.loop           = true;
        pet.onComplete     = null;
        pet.play();
        pet.scale.x = Math.abs(pet.scale.x);
        pet.scale.y = Math.abs(pet.scale.y);
        this.state = 'falling';
        return;  // skip the switch — fall physics will handle the rest
      }
      pet.scale.x = Math.abs(pet.scale.x);
      pet.scale.y = Math.abs(pet.scale.y);
    }

    this.state = newState;

    // ── Per-state visual setup ────────────────────────────
    switch (newState) {
      case 'walk-left':
      case 'walk-right':
      case 'walk-grab-right':
      case 'walk-grab-left':
        this._applyAnim(anims.walk, { speed: 0.18 });
        break;

      case 'walk-off-left':
        // Exit animation (going left) — physics handled by updateWalkOffLeft.
        this._applyAnim(anims.walk, { speed: 0.18 });
        pet.scale.x =  Math.abs(pet.scale.x);  // face left
        this._isPeeking = false;
        this._peekSide  = null;
        break;

      case 'walk-off-right':
        // Exit animation (going right) — physics handled by updateWalkOffRight.
        this._applyAnim(anims.walk, { speed: 0.18 });
        pet.scale.x = -Math.abs(pet.scale.x);  // face right
        this._isPeeking = false;
        this._peekSide  = null;
        break;

      case 'peek-left':
        // Sprite frozen at bottom-left corner, mostly OFF-SCREEN.
        // Anchor is (0.5, 1) (bottom-center), so we push the anchor
        // LEFT of x=0 and BELOW the viewport bottom — only the
        // top-right ~PEEK_INSET_H × PEEK_INSET_V px of the sprite
        // remains visible, looking like the avatar is hiding behind
        // the left wall with just its head peeking out.
        // Animation LOOP (peek frames cycle continuously).
        this._applyAnim(anims.peek, { speed: 0.02, loop: true });
        // FLIPPED: face LEFT so the head looks toward the left edge
        // (out of the viewport), like the avatar is hiding behind
        // the left wall and peeking around it.
        pet.scale.x = -Math.abs(pet.scale.x);
        // Sprite dimensions after scale (shime1 is 128px source)
        const peekLeftW = pet.width  || 128 * SPRITE_SCALE;
        const peekLeftH = pet.height || 128 * SPRITE_SCALE;
        // x: anchor pushed left so only PEEK_INSET_H px of sprite's
        //    right side remains inside the viewport
        pet.x = PEEK_INSET_H - peekLeftW / 2;
        // y: anchor pushed below viewport bottom so only PEEK_INSET_V px
        //    of sprite's top remains inside the viewport
        pet.y = window.innerHeight + (peekLeftH - PEEK_INSET_V);
        this._isPeeking    = true;
        this._peekSide     = 'left';
        this._lastPeekSide = 'left';
        break;

      case 'peek-right':
        // Mirror of peek-left — sprite hidden behind the right wall,
        // head peeking out at the bottom-right corner.
        // Animation LOOP (peek frames cycle continuously).
        this._applyAnim(anims.peek, { speed: 0.02, loop: true });
        // FLIPPED: face RIGHT so the head looks toward the right edge
        // (out of the viewport), like the avatar is hiding behind
        // the right wall and peeking around it.
        pet.scale.x =  Math.abs(pet.scale.x);
        const peekRightW = pet.width  || 128 * SPRITE_SCALE;
        const peekRightH = pet.height || 128 * SPRITE_SCALE;
        // x: anchor pushed right so only PEEK_INSET_H px of sprite's
        //    left side remains inside the viewport
        pet.x = window.innerWidth - PEEK_INSET_H + peekRightW / 2;
        // y: same vertical clip as peek-left
        pet.y = window.innerHeight + (peekRightH - PEEK_INSET_V);
        this._isPeeking    = true;
        this._peekSide     = 'right';
        this._lastPeekSide = 'right';
        break;

      case 'crawl-left':
      case 'crawl-right':
        // Move-pause crawl. updateCrawlLeft/Right split each pose's
        // duration into a MOVE sub-phase (slide at CRAWL_SPEED) and
        // a PAUSE sub-phase (hold position), then flip the frame.
        this._applyAnim(anims.crawl, { speed: 0, loop: false });
        this._crawlFrameIdx   = 0;
        this._crawlHoldFrames = 0; // start at frame 0 of the move-pause cycle
        this.sprite.gotoAndStop(0);
        break;

      case 'grab-right':
        this._applyAnim(anims.grab, { speed: 0.1 });
        pet.scale.x = -Math.abs(pet.scale.x);
        pet.scale.y =  Math.abs(pet.scale.y);
        this._wallCrawlDir = 1;
        this._startWallPhase(true);
        break;

      case 'grab-left':
        this._applyAnim(anims.grab, { speed: 0.1 });
        // Sprite un-mirrored: hand reaches the left edge of the frame.
        pet.scale.x =  Math.abs(pet.scale.x);
        pet.scale.y =  Math.abs(pet.scale.y);
        this._wallCrawlDir = 1;
        this._startWallPhase(true);
        break;

      case 'jump-grab-right': {
        this._applyAnim(anims.jump, { speed: 0.04 });
        pet.scale.x = -Math.abs(pet.scale.x);  // face right
        // Calculate arc velocity: reach the wall in JUMP_ARC_FRAMES frames.
        // Longer value = slower, more readable arc.
        const distToWall = (window.innerWidth - WALL_SNAP) - pet.x;
        this._jumpVelX = Math.max(2, distToWall / JUMP_ARC_FRAMES);
        this._jumpVelY = JUMP_LAUNCH_VEL_Y;  // upward launch impulse
        break;
      }

      case 'jump-grab-left': {
        this._applyAnim(anims.jump, { speed: 0.04 });
        pet.scale.x = Math.abs(pet.scale.x);   // face left
        const distToWall = pet.x - WALL_SNAP;
        this._jumpVelX = Math.max(2, distToWall / JUMP_ARC_FRAMES);
        this._jumpVelY = JUMP_LAUNCH_VEL_Y;
        break;
      }

      case 'crawl_top':
        this._applyAnim(anims.crawl_top, { speed: 0.12 });
        pet.anchor.set(0.5, 1);
        snapToCeiling(this);
        pet.rotation = 0;
        pet.scale.x = Math.abs(pet.scale.x);
        pet.scale.y = Math.abs(pet.scale.y);
        // Crawl into the ceiling from the right wall — face left by default.
        if (this._lastWallWas === 'grab-right') {
          pet.scale.x = -Math.abs(pet.scale.x);
          this._ceilingCrawlDir = -1;
        } else {
          this._ceilingCrawlDir = 1;
        }
        this._startCeilingPhase(true);
        break;

      case 'sit':
        this._applyAnim(anims.sit);
        if (pet.x >= window.innerWidth - WALL_SNAP) pet.x -= 20;
        pet.scale.x = Math.abs(pet.scale.x);
        break;

      case 'say_hi':
        this._applyAnim(anims.say_hi, { speed: 0.12 });
        pet.scale.x = Math.abs(pet.scale.x);
        this.bubble.setText('Hi there! 👋');
        this.bubble.show();
        break;

      case 'wave':
        this._applyAnim(anims.wave, { speed: 0.08, loop: false });
        pet.scale.x = Math.abs(pet.scale.x);
        this.waveBubble.setText('Hi Meow! 👋');
        this.waveBubble.show();
        break;

      case 'summon': {
        this._applyAnim(anims.summon_falling, { speed: 0.15 });
        pet.scale.x = Math.abs(pet.scale.x);
        pet.scale.y = Math.abs(pet.scale.y);
        const srcH = anims.summon_falling[0]?.height || 128;
        pet.x = window.innerWidth / 2;
        pet.y = -srcH * Math.abs(pet.scale.y) + 10;
        this._summonFalling = true;
        this._summonFallVel = 0;
        this._summonStage   = 'falling';
        break;
      }

      case 'tv_clone':
        this._applyAnim(anims.tv_clone, { speed: 0.04, loop: false });
        pet.scale.x = Math.abs(pet.scale.x);
        break;

      case 'remove_cap':
        this._applyAnim(anims.remove_cap, { speed: 0.04, loop: false });
        pet.scale.x = Math.abs(pet.scale.x);
        break;

      // ── Future states — uncomment when ready ──────────
      // case 'jump':
      //   this._applyAnim(anims.jump_up, { speed: 0.15 });
      //   break;
      // case 'sleep':
      //   this._applyAnim(anims.sleep_loop, { speed: 0.06 });
      //   break;

      default:
        this._applyAnim(anims.idle);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — Auto-pilot
  // ═══════════════════════════════════════════════════════════

  startAuto() {
    if (this._autoEnabled) return;

    // Returning from peek state: place the sprite back inside the
    // viewport near the edge it was peeking from, then resume normal
    // auto-pilot behavior (which will pick a state from its transition
    // table, so the avatar won't stand awkwardly).
    if (this._isPeeking) {
      this._isPeeking = false;
      this._peekSide  = null;
      // Drop sprite back to a sensible on-screen position. Use the
      // visible "peek" margin so the avatar starts right at the edge
      // it was hiding behind — looks like it's walking back in.
      const fromLeft = this._lastPeekSide === 'left';
      this.sprite.x = fromLeft
        ? PEEK_INSET_H
        : window.innerWidth - PEEK_INSET_H;
      // Bottom-aligned, sitting on the ground
      this.sprite.y = window.innerHeight;
      // Face AWAY from the edge it was peeking through (into the
      // viewport) so the first auto state looks natural.
      this.sprite.scale.x = fromLeft
        ?  Math.abs(this.sprite.scale.x)   // was peeking-left → face right
        : -Math.abs(this.sprite.scale.x);  // was peeking-right → face left
    }

    this._autoEnabled = true;
    // Any pending "resume auto after delay" timer is now redundant
    this._cancelAutoResume();
    this._scheduleNextTransition();
  }

  stopAuto() {
    this._autoEnabled = false;
    clearTimeout(this._autoTimer);
    this._autoTimer = null;
    // User explicitly stopped auto — cancel any auto-resume too,
    // otherwise the pending timer would re-enable auto after a delay.
    this._cancelAutoResume();
    this.sprite.onComplete = null;  // cancel pending one-shot callback
    this.changeState('idle');
  }

  /**
   * Make the avatar walk off the screen in a randomly chosen direction
   * and enter the peek state (frozen, head visible at the edge).
   *
   * Reversed by startAuto(): the sprite teleports back to a sensible
   * position near where it was, and auto-pilot takes over.
   *
   * Safe to call from any state (dragging, falling, mid-animation).
   * No-op if already peeking.
   */
  exitToPeek() {
    if (this._isPeeking) return;

    // Cancel any in-flight interaction so the sprite is cleanly ours.
    if (this._isDragging || this._isFalling) {
      this._isDragging = false;
      this._isFalling  = false;
      this._velocityX  = 0;
      this._velocityY  = 0;
    }

    // Stop auto-pilot immediately so it doesn't pick a competing state
    // mid-walk-off. (Calling stopAuto() also clears any pending auto-
    // resume timer, which is exactly what we want — the user explicitly
    // dismissed the avatar, so we don't want it auto-returning.)
    this.stopAuto();

    // Pick a random exit side. Math.random() < 0.5 → right, else left.
    const goRight = Math.random() < 0.5;
    this.changeState(goRight ? 'walk-off-right' : 'walk-off-left');
  }

  toggleAuto() {
    if (this._autoEnabled) { this.stopAuto();  return false; }
    else                   { this.startAuto(); return true;  }
  }

  get isAuto() { return this._autoEnabled; }

  /**
   * User-invoked state change (menu button, API call from outside, etc.).
   * Plays the requested state and then automatically resumes auto-pilot
   * after AUTO_RESUME_DELAY_MS, even if auto was previously off.
   *
   * @param {string} name  State name (same as changeState)
   */
  triggerState(name) {
    this._scheduleAutoResume();
    this.changeState(name);
  }

  // ── Auto-resume helpers ─────────────────────────────────

  _scheduleAutoResume() {
    this._cancelAutoResume();
    this._autoResumeTimer = setTimeout(() => {
      this._autoResumeTimer = null;
      if (!this._autoEnabled) this.startAuto();
    }, AUTO_RESUME_DELAY_MS);
  }

  _cancelAutoResume() {
    if (this._autoResumeTimer !== null) {
      clearTimeout(this._autoResumeTimer);
      this._autoResumeTimer = null;
    }
  }

  // ── Wall phase helpers ─────────────────────────────────

  /**
   * Start a new wall phase (crawl or pause). When the current phase
   * expires, picks a random next phase and continues. The pet can
   * also release the wall naturally by hitting the floor or ceiling.
   *
   * @param {boolean} isCrawl  true to start crawling, false to pause
   */
  _startWallPhase(isCrawl) {
    this._wallPhaseIsCrawl = isCrawl;
    const min = isCrawl ? WALL_CRAWL_MIN_FRAMES : WALL_CRAWL_MIN_FRAMES;
    const max = WALL_CRAWL_MAX_FRAMES;
    this._wallPhaseFrames = min + Math.floor(Math.random() * (max - min));
    // During pause phase, freeze the grab sprite so the limbs stop
    // cycling while the pet is supposed to be holding still.
    // When transitioning back to crawl, resume the frame loop.
    if (isCrawl) {
      this.sprite.gotoAndPlay(0);
    } else {
      freezeGrab(this);
    }
  }

  // ── Ceiling phase helpers ──────────────────────────────

  /**
   * Start a new ceiling phase (crawl or pause). When the current phase
   * expires, picks a random next phase and continues. The pet can also
   * release the ceiling naturally by hitting an edge (with some chance)
   * or randomly mid-crawl.
   *
   * @param {boolean} isCrawl  true to start crawling, false to pause
   */
  _startCeilingPhase(isCrawl) {
    this._ceilingPhaseIsCrawl = isCrawl;
    const min = isCrawl ? CEILING_CRAWL_MIN_FRAMES : CEILING_CRAWL_MIN_FRAMES;
    const max = CEILING_CRAWL_MAX_FRAMES;
    this._ceilingPhaseFrames = min + Math.floor(Math.random() * (max - min));
    // During pause phase, freeze the crawl_top sprite so the limbs stop
    // cycling. Resume the frame loop when crawling again.
    if (isCrawl) {
      this.sprite.gotoAndPlay(0);
    } else {
      freezeCrawlTop(this);
    }
  }

  // ── Auto-pilot internals ────────────────────────────────

  /**
   * True when the pet is on a wall (grab-right/left) but still too
   * far from the ceiling for the crawl_top animation to look right.
   * The threshold is the same one used by updateGrabRight/Left to
   * release the pet to ceiling crawl (y <= 80).
   */
  _isFarFromCeiling() {
    return (this.state === 'grab-right' || this.state === 'grab-left')
        && this.sprite.y > 80;
  }

  /**
   * Force the wall-crawl phase to head upward and extend its duration
   * so the pet reaches the ceiling before auto-pilot picks crawl_top
   * again. Used when auto-pilot prematurely picks crawl_top while the
   * pet is still low on the wall.
   */
  _forceWallCrawlUp() {
    this._wallCrawlDir = -1;  // crawl up
    this._wallPhaseIsCrawl = true;
    // Give it a generous crawl duration to actually reach the ceiling.
    this._wallPhaseFrames = WALL_CRAWL_MAX_FRAMES;
    // Restart animation playback so the crawl reads as continuous motion.
    if (this.sprite.textures !== this.animations.grab) {
      this.sprite.textures = this.animations.grab;
      this.sprite.loop = true;
      this.sprite.animationSpeed = 0.1;
      this.sprite.gotoAndPlay(0);
    }
  }

  /**
   * Look up the CURRENT state in the transition table, pick a
   * random allowed next state (avoiding the last one), transition,
   * then schedule the next pick.
   */
  _scheduleNextTransition() {
    if (!this._autoEnabled) return;

    // Look up the current state (may have changed via physics)
    const entry = STATE_TRANSITIONS[this.state];
    if (!entry || !entry.next.length) {
      // Unknown state or dead end — fall back to idle
      this.changeState('idle');
      const pause = AUTO_IDLE_MIN_MS
        + Math.random() * (AUTO_IDLE_MAX_MS - AUTO_IDLE_MIN_MS);
      this._autoTimer = setTimeout(() => this._scheduleNextTransition(), pause);
      return;
    }

    // Filter out the last played state to avoid repeats
    let candidates = entry.next.filter(s => s !== this._lastAutoState);
    if (candidates.length === 0) candidates = entry.next;  // only one option

    // Pick randomly
    let nextState = candidates[Math.floor(Math.random() * candidates.length)];

    // Ceiling crawl needs the pet to be near the ceiling. If auto-pilot
    // picked crawl_top while the pet is still far from the ceiling
    // (e.g. just after grabbing the wall), force upward crawl and
    // re-pick. We re-pick so the pet stays on the wall for another
    // burst before trying the ceiling again.
    if (nextState === 'crawl_top' && this._isFarFromCeiling()) {
      this._forceWallCrawlUp();
      nextState = this.state === 'grab-right' ? 'grab-right' : 'grab-left';
      this._lastAutoState = null;  // don't filter the re-pick
    }

    this._lastAutoState = nextState;
    this.changeState(nextState);

    // Schedule next transition based on the target state's type
    const nextEntry = STATE_TRANSITIONS[nextState];

    if (nextEntry?.type === 'once') {
      // ── ONE-SHOT: wait for animation to finish via onComplete ──
      const prevOnComplete = this.sprite.onComplete;
      this.sprite.onComplete = () => {
        this.sprite.onComplete = null;
        if (prevOnComplete) prevOnComplete();
        if (!this._autoEnabled) return;
        this._scheduleNextTransition();
      };
    } else {
      // ── LOOP: random duration from minMs–maxMs ────────────────
      const min = nextEntry?.minMs ?? 2000;
      const max = nextEntry?.maxMs ?? 4000;
      const duration = min + Math.random() * (max - min);

      this._autoTimer = setTimeout(() => {
        if (!this._autoEnabled) return;
        this._scheduleNextTransition();
      }, duration);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — Lifecycle
  // ═══════════════════════════════════════════════════════════

  destroy() {
    this.stopAuto();
    this.app.ticker.remove(this._tick, this);
    this.app.destroy(true, { children: true, texture: false, baseTexture: false });
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Animation helper
  // ═══════════════════════════════════════════════════════════

  _applyAnim(textures, opts = {}) {
    this.sprite.textures       = textures;
    this.sprite.loop           = opts.loop ?? true;
    this.sprite.animationSpeed = opts.speed ?? 0.15;
    this.sprite.gotoAndPlay(0);
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Game-loop tick (delegates to state modules)
  // ═══════════════════════════════════════════════════════════

  _tick() {
    this.bubble.follow();
    this.waveBubble.follow();

    if (this._isDragging)  return updateDrag(this);
    if (this._isFalling)   return updateFall(this);

    switch (this.state) {
      case 'walk-left':        return updateWalkLeft(this);
      case 'walk-right':       return updateWalkRight(this);
      case 'walk-off-left':    return updateWalkOffLeft(this);
      case 'walk-off-right':   return updateWalkOffRight(this);
      case 'walk-grab-right':  return updateWalkGrabRight(this);
      case 'walk-grab-left':   return updateWalkGrabLeft(this);
      case 'jump-grab-right':  return updateJumpGrabRight(this);
      case 'jump-grab-left':   return updateJumpGrabLeft(this);
      case 'grab-right':       return updateGrabRight(this);
      case 'grab-left':        return updateGrabLeft(this);
      case 'crawl-left':       return updateCrawlLeft(this);
      case 'crawl-right':      return updateCrawlRight(this);
      case 'crawl_top':        return updateCrawlTop(this);
      case 'say_hi':           return updateSayHi(this);
      case 'summon':           return updateSummon(this);
      // case 'sleep':         return updateSleep(this);
      // case 'jump':          return updateJump(this);
      default: break; // sit, wave, idle — no per-frame physics
    }
  }
}
