/** Options for the chat's AI connection. */
export interface PetfolioAiOptions {
  /** URL of the knowledge base JSON (or the data itself). Default `/petfolio-knowledgeBase.json`. */
  knowledge?: string | Array<{ source: string; content: string }>;
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

export interface PetfolioOptions {
  /** Start auto-pilot immediately. Default `true`. */
  autoStart?: boolean;
  /** Character key, e.g. `'an2'` or `'finn'`. See `Petfolio.availableCharacters()`. */
  character?: string;
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
  /** Override where sprite PNGs are loaded from (dev only; sprites are bundled). */
  spriteDir?: string;
}

export class Petfolio {
  /**
   * Create a full-screen, click-through canvas with a pet on it and (by default)
   * start its auto-pilot. Browser only — call it from `useEffect` / `onMount` in SSR frameworks.
   */
  static summon(options?: PetfolioOptions): Petfolio;
  /** Keys of the bundled characters. */
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

  readonly currentCharacter: string;
  readonly availableCharacters: string[];
  setCharacter(name: string): void;
  scale: number;

  /** Remove the pet, its canvas and its menu. */
  destroy(): void;
}
