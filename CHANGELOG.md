# Changelog

`petfolio` (the widget) and `petfolio-cli` are released together and share a version number.

## 2.0.0

### Breaking changes
- **`petfolio-cli` no longer scans your project.** You write one text file and run
  `npx petfolio-cli about-me.txt`. The flags `--scan-only` / `--ci` are gone (the command is always
  non-interactive now), and so is the API-key prompt: create `.env` yourself.
- **New knowledge file.** The output is `public/petfolio-knowledge.json` (was `petfolio-knowledgeBase.json`):
  titled `sections` plus an optional `personality`. The widget no longer reads the old array format.
- **The widget sends the whole text with every question** instead of searching it (no TF·IDF). Your server route
  must accept bigger requests — see "Upgrading from 1.x" in the README.
- Default Groq model is now `qwen/qwen3.8-27b` (`llama-3.1-8b-instant` was retired by Groq).

### Added
- Personality: describe the pet's voice under a `# Personality` heading in your text file.
- `chat: false` option to hide the chat button; `ai.knowledge` accepts `{ sections }`, `{ content }` or a string.
- TypeScript types, a `<script>`-tag build (`dist/petfolio.global.js`, `unpkg`/`jsdelivr` fields).
- Tap / click on the pet opens the menu (touch screens have no right-click).
- Works under a strict Content-Security-Policy (no `unsafe-eval`, no `unsafe-inline` styles).

### Fixed
- The full-screen canvas swallowed every click, text selection and scroll of the host page. It is now
  click-through; only the pet's visible pixels catch the mouse.
- Pressing Exit while on a wall or the ceiling made the pet walk in mid-air; it now drops to the floor first.
- The right wall is the visible edge of the page, not the edge behind a scrollbar.
- The bundle is ASCII-only (it broke when served without a UTF-8 charset); non-Latin words are tokenised correctly.
- `pixi.js` is bundled, so it is no longer a runtime dependency; removed a PixiJS deprecation warning.
