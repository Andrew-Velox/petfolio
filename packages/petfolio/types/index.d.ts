/** The contents of petfolio-knowledge.json. */
export interface PetfolioKnowledge {
  /** Format version written by petfolio-cli. */
  version?: number;
  /** Titled sections of facts, as written by petfolio-cli (together max 20,000 characters). */
  sections?: Array<{ title: string; text: string }>;
  /** Alternative to `sections` for inline use: one block of text. */
  content?: string;
  /** How the pet should sound (max 2,000 characters). Optional. */
  personality?: string;
}

/** Options for the chat's AI connection. */
export interface PetfolioAiOptions {
  /**
   * Where the pet reads what it knows: the URL of the file `npx petfolio-cli about-me.txt` writes
   * (default `/petfolio-knowledge.json`), or the data itself: `{ sections, personality? }`, `{ content, personality? }` or a plain string.
   * All of it is sent with every question.
   */
  knowledge?: string | PetfolioKnowledge;
  /**
   * URL of YOUR server route that adds the API key and forwards the request to the
   * provider (recommended: the key never reaches the browser).
   */
  endpoint?: string;
  /** Direct mode, for local testing only: the key is visible to anyone using the page. */
  apiKey?: string;
  /** Default `'groq'`. */
  provider?: 'groq' | 'gemini';
  /** Override the provider's default model name. */
  model?: string;
}

/** Movement modes — see the `physics` option. */
export type PetfolioPhysics = 'floor' | 'page' | 'corner';

/** Why `physics: 'page'` is not in use right now. */
export type PetfolioPhysicsFallback =
  | 'reduced-motion' | 'touch-only' | 'narrow-viewport' | 'few-platforms' | 'unstable';

export interface PetfolioOptions {
  /** Start auto-pilot immediately. Default `true`. */
  autoStart?: boolean;
  /**
   * Avatar name. `'finn'` (the default) is built into the package; any other name from the
   * site's Avatars page (e.g. `'an2'`) is downloaded from the avatar CDN when the pet starts.
   * If the download fails the pet falls back to `'finn'` and logs a warning.
   */
  character?: string;
  /**
   * Where avatars other than the bundled one are downloaded from. Default: jsDelivr serving the
   * repo's `avatars/` folder. Point it at your own copy (or a pinned tag) to self-host.
   * Sites with a Content-Security-Policy must allow `img-src` for this origin.
   */
  avatarBase?: string;
  /** Sprite scale. Default `0.95`. */
  scale?: number;
  /** Multiplier for the long idle periods (1 = original Shimeji, <1 = livelier). */
  idleScale?: number;
  /** Right-click menu + chat panel. `false` = a plain pet with no UI. Default `true`. */
  ui?: boolean;
  /** Persona name shown in the chat and used in the prompt. Default `'Petfolio'`. */
  name?: string;
  /** Chat / AI settings. */
  ai?: PetfolioAiOptions;
  /** `false` = hide the chat button (no AI). Default `true`. */
  chat?: boolean;
  /** Starter questions shown as chips in the chat. `[]` = none. */
  suggestions?: string[];
  /** Cute lines for the say-hi animation and random chatter. */
  phrases?: string[];
  /** `false` = no random speech bubbles; `{ min, max }` = seconds between them. Default 12–30. */
  chatter?: boolean | { min?: number; max?: number };
  /** Called when the menu's Settings button is pressed. */
  onSettings?: () => void;
  /**
   * How the pet moves. `'floor'` (default): the window edges only. `'page'`: the top edges of paragraphs,
   * headings, images … are ledges to stand and walk on (falls back to `'floor'` on phones, touch devices,
   * reduced motion and unstable layouts). `'corner'`: the pet parks in the bottom corner and idles.
   */
  physics?: PetfolioPhysics;
  /** Override where sprite PNGs are loaded from (dev only; sprites are bundled). */
  spriteDir?: string;
}

export class Petfolio {
  /**
   * Create a full-screen, click-through canvas with a pet on it and (by default)
   * start its auto-pilot. Browser only — call it from `useEffect` / `onMount` in SSR frameworks.
   */
  static summon(options?: PetfolioOptions): Petfolio;
  /** Names of the avatars built into the package (just the default). Others are downloaded by name. */
  static availableCharacters(): string[];

  /** Use `Petfolio.summon()` unless you manage your own canvas. */
  constructor(canvas: HTMLCanvasElement, options?: Omit<PetfolioOptions, 'autoStart'>);

  /** Name of the behaviour currently playing. */
  readonly state: string;
  /** Switch behaviour now: a Shimeji behaviour name (`'ClimbAlongWall'`) or `'idle' | 'sit' | 'say_hi' | …`. */
  changeState(name: string): void;
  /** Like `changeState`, then auto-pilot resumes after a short delay. */
  triggerState(name: string): void;
  /** Chase the mouse pointer. */
  chaseMouse(): void;

  startAuto(): void;
  stopAuto(): void;
  /** @returns whether auto-pilot is now on */
  toggleAuto(): boolean;
  readonly isAuto: boolean;

  /** Walk off screen and peek in from the corner. Click the pet (or `startAuto()`) to bring it back. */
  exitToPeek(): void;
  readonly isPeeking: boolean;

  /** Stand still and show the chat (what the menu's chat button does). */
  startChat(): void;
  endChat(): void;
  readonly isChatting: boolean;

  /** The movement mode in use right now (`'page'` may be `'floor'` — see `physicsFallbackReason`). */
  readonly physicsMode: PetfolioPhysics;
  /** Why `'page'` physics is not in use, or `null` (in use, or not requested). */
  readonly physicsFallbackReason: PetfolioPhysicsFallback | null;
  /** Change the requested movement mode at runtime. */
  setPhysics(mode: PetfolioPhysics): void;

  readonly currentCharacter: string;
  /** Names of the avatars built into the package (just the default). */
  readonly availableCharacters: string[];
  /**
   * Switch avatar. The bundled one switches at once; any other name is downloaded first and the pet
   * keeps its current look until it is ready.
   * @returns `true` once the avatar is in use, `false` for an invalid name or a failed download
   */
  setCharacter(name: string): Promise<boolean>;
  scale: number;

  /** Remove the pet, its canvas and its menu. */
  destroy(): void;
}
