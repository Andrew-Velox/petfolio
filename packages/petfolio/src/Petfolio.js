/**
 * Petfolio.js — Pixi renderer + public API around the Shimeji engine.
 *
 * All behaviour lives in src/engine/ (a port of Shimeji's action/behaviour
 * system, no Pixi inside). This class only does the web-specific parts:
 *
 *   • drives the engine at Shimeji's fixed 25 ticks/second
 *   • draws the mascot: pose → sprite texture, anchor → position,
 *     lookRight → mirrored sprite
 *   • forwards pointer input (interaction.js) and speech bubbles
 *   • keeps the public API of earlier Petfolio versions
 *
 * Usage:
 *   import { Petfolio } from './Petfolio.js';
 *   const pet = new Petfolio(document.getElementById('canvas'));
 *   pet.startAuto();
 */
import * as PIXI from 'pixi.js';

import {
  SPRITE_SCALE, FRAME_SIZE, SMOOTH_RENDER, SMOOTH_MAX_JUMP,
  AUTO_RESUME_DELAY_MS, IDLE_DURATION_SCALE,
  EXIT_OFFSCREEN_OFFSET, PEEK_INSET_H, PEEK_INSET_V,
  CHATTER_MIN_S, CHATTER_MAX_S, CHATTER_SHOW_MS,
} from './constants.js';
import { phrasePicker }       from './phrases.js';
import { createWorld, STATE_ALIASES, TICK_MS } from './engine/index.js';
import { makeTextureLoader } from './textures.js';
import { makeBubble }        from './bubble.js';
import { initInteraction }   from './interaction.js';
import { createUI }          from './ui/index.js';
import { CHARACTERS, DEFAULT_CHARACTER } from './characters/characters.js';

// Behaviours that just hold still (what the mascot does while auto-pilot is off).
const HOLD_BEHAVIORS = new Set(['Idle', 'HoldWall', 'HoldCeiling']);
// Physics behaviours that must not be interrupted by stopAuto().
const PHYSICS_BEHAVIORS = new Set(['Fall', 'Dragged', 'Thrown', 'Descend']);
// Exit / peek / enter sequences happen off-screen; the chat waits for them.
const OFFSCREEN_BEHAVIOR = /^(Exit|Peek|Enter)/;

export class Petfolio {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object}            [opts]
   * @param {string}            [opts.spriteDir='/sprites/']  Dev-mode sprite path
   * @param {string}            [opts.character]              Character key (default: first registered)
   * @param {number}            [opts.scale]                  Sprite scale (default 0.95)
   * @param {number}            [opts.idleScale]              Multiplier for long idle periods (default 1 = Shimeji)
   * @param {boolean}           [opts.ui=true]                Right-click icon bar + chat panel (false = headless pet)
   * @param {string}            [opts.name='Petfolio']        Persona name shown in the chat
   * @param {object}            [opts.ai]                     Chat options: { knowledge, endpoint, apiKey, provider, model }
   * @param {string[]}          [opts.phrases]                Cute lines for the SayHi greeting and random chatter (default: built-in list)
   * @param {boolean|{min:number,max:number}} [opts.chatter=true]  Random speech bubbles every min–max seconds (false = only SayHi)
   * @param {string[]}          [opts.suggestions]            Starter questions shown as chips in the chat ([] = none)
   * @param {Function}          [opts.onSettings]             Called when the menu's settings button is pressed
   */
  constructor(canvas, opts = {}) {
    const initialChar = opts.character ?? DEFAULT_CHARACTER;
    if (!CHARACTERS[initialChar]) {
      throw new Error(`Petfolio: unknown character "${initialChar}". ` +
        `Available: ${Object.keys(CHARACTERS).join(', ')}`);
    }

    // ── Pixi bootstrap ──────────────────────────────────────
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    this.app = new PIXI.Application({
      view:        canvas,
      resizeTo:    window,
      transparent: true,
    });

    // ── Character / textures ────────────────────────────────
    this._spriteDir        = opts.spriteDir ?? '/sprites/';
    this._currentCharacter = initialChar;
    this._tex              = this._loaderFor(initialChar);

    // ── Sprite (one sprite, re-posed by the engine every tick) ──
    this._scale = opts.scale ?? SPRITE_SCALE;
    this.sprite = new PIXI.Sprite(this._tex(1));
    this.sprite.anchor.set(0.5, 1);
    this.sprite.scale.set(this._scale);
    this.app.stage.addChild(this.sprite);

    // ── Speech bubbles ──────────────────────────────────────
    this.bubble = makeBubble(this.sprite, 'Hi!', {
      mirrorOnFacing: true,
      sideOffset:     0,
      offsetYExtra:   -55,
    });
    this.app.stage.addChild(this.bubble.container);

    // ── Phrases (SayHi + random chatter share one picker, so no repeats) ──
    this._pickPhrase = phrasePicker(opts.phrases);
    const chatter = opts.chatter === false ? null
      : { min: CHATTER_MIN_S, max: CHATTER_MAX_S, ...(typeof opts.chatter === 'object' ? opts.chatter : {}) };
    this._chatter      = chatter;
    this._chatterTicks = 0;            // ticks until the next random message
    this._bubbleTicks  = 0;            // >0: a timed message is up (survives behaviour changes)
    this._scheduleChatter();

    // ── Engine ──────────────────────────────────────────────
    const world = createWorld(
      () => ({ width: window.innerWidth, height: window.innerHeight }),
      {
        scaling: this._scale,
        config: {
          idleScale:     opts.idleScale ?? IDLE_DURATION_SCALE,
          exitOffscreen: EXIT_OFFSCREEN_OFFSET,
          peekInsetH:    PEEK_INSET_H,
          peekInsetV:    PEEK_INSET_V,
          pickPhrase:    this._pickPhrase,
        },
      },
    );
    this.env    = world.env;
    this.config = world.config;
    this.mascot = world.mascot;
    this.mascot.autoEnabled = false;              // startAuto() turns it on
    this.mascot.onBehavior  = (name) => {
      // A timed chatter bubble rides along with the next animation; anything
      // that takes over the pet (held, exiting, chatting) clears it.
      if (this._bubbleTicks > 0 && !/^(Dragged|Thrown|Exit|Peek|Chat)/.test(name)) return;
      this._hideBubbles();
    };
    this.mascot.onSay       = (text) => this._say(text);

    // Spawn mid-screen and drop (same as the original), then idle / auto.
    this.mascot.anchor.x = Math.round(window.innerWidth / 2);
    this.mascot.anchor.y = Math.round(window.innerHeight / 2 + 100);
    this.mascot.setBehavior(this.config.buildBehavior('Fall'));

    // ── Loop state ──────────────────────────────────────────
    this._acc          = 0;            // ms accumulated toward the next engine tick
    this._prevX        = this.mascot.anchor.x;
    this._prevY        = this.mascot.anchor.y;
    this._resumeTicks  = 0;            // ticks until auto-pilot re-enables after a user action
    this._chatWanted   = false;        // chat panel open → hold the 'Chat' pose when grounded
    this._chatWasAuto  = false;
    this.smooth        = SMOOTH_RENDER;

    // ── Wire up input & start loop ──────────────────────────
    initInteraction(this);
    this.ui = opts.ui === false ? null : createUI(this, {
      name: opts.name, ai: opts.ai, suggestions: opts.suggestions, onSettings: opts.onSettings,
    });
    this.app.ticker.add(this._frame, this);
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — State
  // ═══════════════════════════════════════════════════════════

  /** Name of the behaviour currently playing (Shimeji behaviour name). */
  get state() { return this.mascot.behaviorName; }

  /**
   * Switch to a behaviour right now. Accepts a Shimeji behaviour name
   * (e.g. 'ClimbAlongWall', 'JumpToRightWall') or one of the legacy state
   * names ('walk-left', 'say_hi', …).
   */
  changeState(name) {
    let target = STATE_ALIASES[name] ?? name;
    if (!this.config.has(target)) {
      console.warn(`Petfolio: unknown state "${name}", idling instead.`);
      target = 'Idle';
    }
    this.mascot.dragging = false;
    this.mascot.setBehavior(this.config.buildBehavior(target));
  }

  /**
   * User-invoked state change (menu button, API call from outside, …).
   * Plays the requested state and then resumes auto-pilot after
   * AUTO_RESUME_DELAY_MS, even if auto was previously off.
   */
  triggerState(name) {
    this._scheduleAutoResume();
    this.changeState(name);
  }

  /** Make the mascot chase the pointer (Shimeji's "Follow cursor"). */
  chaseMouse() { this.changeState('ChaseMouse'); }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — Auto-pilot
  // ═══════════════════════════════════════════════════════════
  //
  // Auto-pilot is Shimeji's own loop: when a behaviour finishes the engine
  // picks the next one by weighted random from what is possible right now
  // (floor → walk / sit / run to a wall …, wall → climb / fall …, ceiling →
  // crawl / drop …). "Off" just means: after the current behaviour, hold still.

  startAuto() {
    if (this.mascot.autoEnabled) return;
    this._cancelAutoResume();

    const name = this.mascot.behaviorName;
    if (name === 'PeekLeft' || name === 'PeekRight') {
      // Coming back from the exit: walk in from the edge it left through.
      this.mascot.autoEnabled = true;
      this.mascot.setBehavior(this.config.buildBehavior(name === 'PeekLeft' ? 'EnterLeft' : 'EnterRight'));
      return;
    }

    this.mascot.autoEnabled = true;
    // A hold behaviour never ends on its own — kick the first pick now.
    if (HOLD_BEHAVIORS.has(name)) {
      this.mascot.setBehavior(this.config.buildNextBehavior(null, this.mascot));
    }
  }

  stopAuto() {
    this.mascot.autoEnabled = false;
    this._cancelAutoResume();
    // Settle into idle — but never cut physics short (mid-throw, being held).
    if (!PHYSICS_BEHAVIORS.has(this.mascot.behaviorName)) this.changeState('idle');
  }

  toggleAuto() {
    if (this.mascot.autoEnabled) { this.stopAuto();  return false; }
    this.startAuto();
    return true;
  }

  get isAuto() { return this.mascot.autoEnabled; }

  /**
   * Walk off the screen in a random direction and freeze in the peek pose
   * (head poking in at the bottom corner). Reversed by startAuto().
   * Safe to call from any state. No-op if already peeking.
   */
  exitToPeek() {
    if (this.isPeeking) return;
    this.stopAuto();
    this.changeState(Math.random() < 0.5 ? 'ExitRight' : 'ExitLeft');
  }

  get isPeeking() {
    const n = this.mascot.behaviorName;
    return n === 'PeekLeft' || n === 'PeekRight';
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — Chat
  // ═══════════════════════════════════════════════════════════
  //
  // While the chat panel is open the mascot stands still on the floor in a
  // single frame (the SayHi pose) and the panel takes the speech bubble's
  // place, positioned exactly like the SayHi message. If it is on a wall / ceiling / in the air it
  // gets down first; if peeking from the edge it walks back in.

  startChat() {
    if (this._chatWanted) return;
    this._chatWanted  = true;
    this._chatWasAuto = this.mascot.autoEnabled || this.isPeeking;
    if (this.isPeeking) this.startAuto();     // walk back in…
    this.mascot.autoEnabled = false;          // …then hold still, don't wander off
    this._cancelAutoResume();
    this._hideBubbles();
    this._holdForChat();
  }

  endChat() {
    if (!this._chatWanted) return;
    this._chatWanted = false;
    const m = this.mascot;
    if (this._chatWasAuto) m.autoEnabled = true;
    if (m.behaviorName === 'Chat') {
      m.setBehavior(m.autoEnabled
        ? this.config.buildNextBehavior(null, m)
        : this.config.buildHold(m));
    }
  }

  get isChatting() { return this._chatWanted; }

  /** Switch to the Chat pose as soon as the mascot is standing on the floor. */
  _holdForChat() {
    const m    = this.mascot;
    const name = m.behaviorName;
    if (name === 'Chat' || name === 'Dragged' || name === 'Descend' || m.dragging || OFFSCREEN_BEHAVIOR.test(name)) return;
    // Fall / Thrown are fine to cut once the feet touch the floor (their own
    // follow-up would be a 4–8 s stand); in mid-air they just keep falling.
    if (m.env.floor.isOn(m.anchor)) {
      m.setBehavior(this.config.buildBehavior('Chat'));
    } else if (m.env.wall.isOn(m.anchor) || m.env.ceiling.isOn(m.anchor)) {
      m.setBehavior(this.config.buildBehavior('Descend'));   // let go, drop to the floor
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — Character & size
  // ═══════════════════════════════════════════════════════════

  get currentCharacter() { return this._currentCharacter; }
  get availableCharacters() { return Object.keys(CHARACTERS); }

  /**
   * Switch to a different character at runtime. Behaviour is untouched —
   * only the sprites change, so it keeps doing whatever it was doing.
   */
  setCharacter(name) {
    if (name === this._currentCharacter) return;
    if (!CHARACTERS[name]) {
      throw new Error(`Petfolio: unknown character "${name}". ` +
        `Available: ${Object.keys(CHARACTERS).join(', ')}`);
    }
    this._currentCharacter = name;
    this._tex = this._loaderFor(name);
    this._lastImg = null;           // force the next render to swap texture
  }

  get scale() { return this._scale; }
  set scale(s) { this._scale = s; this.mascot.scaling = s; }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API — Lifecycle
  // ═══════════════════════════════════════════════════════════

  destroy() {
    this.mascot.autoEnabled = false;
    this._chatWanted = false;
    this.ui?.destroy();
    this.app.ticker.remove(this._frame, this);
    this.app.destroy(true, { children: true, texture: false, baseTexture: false });
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNALS — called by interaction.js
  // ═══════════════════════════════════════════════════════════

  _beginDrag() {
    const m = this.mascot;
    m.dragging = true;
    this._hideBubbles();
    m.setBehavior(this.config.buildBehavior('Dragged'));
  }

  _endDrag() {
    const m = this.mascot;
    if (!m.dragging) return;           // never grabbed, or it already broke free
    m.dragging = false;
    m.setBehavior(this.config.buildBehavior('Thrown'));
    // A throw is a user action — make sure auto-pilot comes back after it.
    if (!m.autoEnabled) this._scheduleAutoResume();
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNALS — loop & rendering
  // ═══════════════════════════════════════════════════════════

  _loaderFor(name) {
    return makeTextureLoader(this._spriteDir, CHARACTERS[name].spriteData);
  }

  /** Pixi ticker callback (once per display frame). */
  _frame() {
    // Fixed-timestep: advance the engine in whole 40 ms ticks, like Shimeji.
    // Clamp so a background tab coming back doesn't fast-forward minutes.
    this._acc += Math.min(this.app.ticker.deltaMS, 200);
    let steps = 0;
    while (this._acc >= TICK_MS && steps < 5) {
      this._prevX = this.mascot.anchor.x;
      this._prevY = this.mascot.anchor.y;
      this._step();
      this._acc -= TICK_MS;
      steps++;
    }
    if (steps === 5) this._acc = 0;

    this._render(this._acc / TICK_MS);
  }

  _step() {
    this.env.tick();
    this.mascot.tick();
    if (this._chatWanted) this._holdForChat();

    if (this._bubbleTicks > 0 && --this._bubbleTicks === 0) this._hideBubbles();
    if (this._chatter && --this._chatterTicks <= 0) this._maybeChatter();

    if (this._resumeTicks > 0 && --this._resumeTicks === 0 && !this.mascot.autoEnabled) {
      this.startAuto();
    }
  }

  _render(alpha) {
    const m    = this.mascot;
    const pose = m.pose;
    const spr  = this.sprite;

    // Pose → texture + anchor (the image pixel that sits on the anchor point).
    if (pose) {
      if (pose !== this._lastPose || pose.img !== this._lastImg) {
        const tex = this._tex(pose.img);
        spr.texture = tex;
        const w = tex.baseTexture.valid ? tex.width  : FRAME_SIZE;
        const h = tex.baseTexture.valid ? tex.height : FRAME_SIZE;
        spr.anchor.set(pose.ax / w, pose.ay / h);
        this._lastPose = pose;
        this._lastImg  = pose.img;
      }
    }

    // Sprites face left; mirror about the anchor to look right.
    spr.scale.x = (m.lookRight ? -1 : 1) * this._scale;
    spr.scale.y = this._scale;

    // Position, interpolated between the last two ticks (never while held,
    // and never across teleports like wall → ceiling).
    let x = m.anchor.x;
    let y = m.anchor.y;
    if (this.smooth && !m.dragging) {
      const dx = x - this._prevX;
      const dy = y - this._prevY;
      if (Math.hypot(dx, dy) <= SMOOTH_MAX_JUMP) {
        x = this._prevX + dx * alpha;
        y = this._prevY + dy * alpha;
      }
    }
    spr.x = x;
    spr.y = y;

    this.bubble.follow();
    if (this.ui?.chat.isOpen) this.ui.chat.follow(this.bubble.placement(), this.app.view.getBoundingClientRect());
  }

  // ── Bubbles ─────────────────────────────────────────────
  _hideBubbles() {
    this._bubbleTicks = 0;
    this.bubble.hide();
  }

  /** @param {number} [ticks]  >0 = hide by itself after this many ticks, otherwise it lasts until the behaviour changes */
  _say(text, ticks = 0) {
    this.bubble.setText(text);
    this.bubble.show();
    this._bubbleTicks = ticks;
  }

  // ── Random chatter ──────────────────────────────────────
  _scheduleChatter(ticks) {
    const c = this._chatter;
    if (!c) return;
    const seconds = c.min + Math.random() * Math.max(0, c.max - c.min);
    this._chatterTicks = ticks ?? Math.max(1, Math.round(seconds * 1000 / TICK_MS));
  }

  /** Say something cute — unless the pet is busy being held, chatting, or out of sight. */
  _maybeChatter() {
    const m = this.mascot;
    const busy = m.dragging || this._chatWanted || this.bubble.container.visible
      || /^(Dragged|Thrown|Exit|Peek|Enter)/.test(m.behaviorName) || m.isOutOfScreen();
    if (busy) { this._scheduleChatter(50); return; }      // look again in 2 s
    this._say(this._pickPhrase(), Math.round(CHATTER_SHOW_MS / TICK_MS));
    this._scheduleChatter();
  }

  // ── Auto-resume ─────────────────────────────────────────
  _scheduleAutoResume() {
    this._resumeTicks = Math.max(1, Math.round(AUTO_RESUME_DELAY_MS / TICK_MS));
  }

  _cancelAutoResume() {
    this._resumeTicks = 0;
  }
}
