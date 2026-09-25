/**
 * MishiPet.js — Slim orchestrator class.
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
 *   import { MishiPet } from './MishiPet.js';
 *   const pet = new MishiPet(document.getElementById('canvas'));
 */
import * as PIXI from 'pixi.js';

// ── Config & data ───────────────────────────────────────────
import {
  SPRITE_SCALE, WALL_SNAP,
  AUTO_IDLE_MIN_MS, AUTO_IDLE_MAX_MS,
} from './constants.js';
import { buildAnimations }     from './animations.js';
import { STATE_TRANSITIONS }   from './transitions.js';
import { makeBubble }          from './bubble.js';
import { initInteraction }   from './interaction.js';

// ── State physics ───────────────────────────────────────────
import {
  updateWalkLeft, updateWalkRight,
  updateCrawlLeft, updateCrawlRight,
  updateCrawlTop, updateSayHi,
  snapToCeiling,
} from './states/walk.js';
import { updateWalkGrabRight, updateJumpGrabRight, updateGrabRight } from './states/wall.js';
import { updateDrag, updateFall }               from './states/drag.js';
import { updateSummon }                         from './states/summon.js';

// ─────────────────────────────────────────────────────────────
// MishiPet class
// ─────────────────────────────────────────────────────────────
export class MishiPet {
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

    // ── Auto-pilot ──────────────────────────────────────────
    this._autoEnabled       = false;
    this._autoTimer         = null;
    this._lastAutoState     = null;   // avoid repeating same state
    this._summonUsed        = false;  // summon entrance plays only once

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
    if (newState !== 'crawl_top' && newState !== 'grab-right' && newState !== 'jump-grab-right') {
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
        this._applyAnim(anims.walk, { speed: 0.18 });
        break;

      case 'crawl-left':
      case 'crawl-right':
        this._applyAnim(anims.crawl, { speed: 0.08 });
        break;

      case 'grab-right':
        this._applyAnim(anims.grab, { speed: 0.1 });
        pet.scale.x = -Math.abs(pet.scale.x);
        pet.scale.y =  Math.abs(pet.scale.y);
        this._wallCrawlDir = 1;
        break;

      case 'jump-grab-right': {
        this._applyAnim(anims.jump, { speed: 0.04 });
        pet.scale.x = -Math.abs(pet.scale.x);  // face right
        // Calculate arc velocity: reach the wall in ~50 frames
        const distToWall = (window.innerWidth - WALL_SNAP) - pet.x;
        this._jumpVelX = Math.max(3, distToWall / 50);
        this._jumpVelY = -7;  // upward launch impulse
        break;
      }

      case 'crawl_top':
        this._applyAnim(anims.crawl_top, { speed: 0.12 });
        pet.anchor.set(0.5, 1);
        snapToCeiling(this);
        pet.rotation = 0;
        pet.scale.x = Math.abs(pet.scale.x);
        pet.scale.y = Math.abs(pet.scale.y);
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
    this._autoEnabled = true;
    this._scheduleNextTransition();
  }

  stopAuto() {
    this._autoEnabled = false;
    clearTimeout(this._autoTimer);
    this._autoTimer = null;
    this.changeState('idle');
  }

  toggleAuto() {
    if (this._autoEnabled) { this.stopAuto();  return false; }
    else                   { this.startAuto(); return true;  }
  }

  get isAuto() { return this._autoEnabled; }

  // ── Auto-pilot internals ────────────────────────────────

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
    const nextState = candidates[Math.floor(Math.random() * candidates.length)];
    this._lastAutoState = nextState;
    this.changeState(nextState);

    // Schedule the next transition after this state's duration
    const nextEntry = STATE_TRANSITIONS[nextState];
    const duration  = nextEntry?.duration ?? 3000;

    this._autoTimer = setTimeout(() => {
      if (!this._autoEnabled) return;
      this._scheduleNextTransition();
    }, duration);
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
      case 'walk-grab-right':  return updateWalkGrabRight(this);
      case 'jump-grab-right':  return updateJumpGrabRight(this);
      case 'grab-right':       return updateGrabRight(this);
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
