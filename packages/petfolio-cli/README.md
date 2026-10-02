# petfolio-cli

Builds the knowledge base for the [Petfolio](https://www.npmjs.com/package/petfolio) chat: it scans your
project for human-readable text and writes `public/petfolio-knowledgeBase.json`, which the pet searches to
answer your visitors' questions.

```bash
npx petfolio-cli                  # interactive: pick Groq/Gemini, paste a key (saved to .env), build the knowledge base
npx petfolio-cli --scan-only      # no prompts, .env untouched — just rebuild the knowledge base (CI / "prebuild")
npx petfolio-cli --out static     # write somewhere other than public/ (SvelteKit: static, Angular: src/assets)
npx petfolio-cli --help
```

## What it reads

String literals and JSX text in `.js .jsx .ts .tsx`, plus **`.md .mdx .txt`** files. It skips `node_modules`,
build output (`dist`, `.next`, `build`, …), tests, config files, `api/` server routes, hooks and the root
`README.md`. Code-like strings (CSS classes, SVG paths, URLs) are filtered out.

**Tip:** prose works best. Write an `about.md` (who you are, what you do, projects, contact, FAQ) and re-run.

## The API key

The key goes to `.env` as `PETFOLIO_GROQ_API_KEY` or `PETFOLIO_GEMINI_API_KEY`. Keep `.env` out of git (the CLI
warns if it isn't ignored) and **never expose it to the browser** — read it in a server route that forwards
chat requests. See the Petfolio README, section "AI chat", for ready-made routes.

## Keep it fresh

```json
{ "scripts": { "kb": "petfolio-cli --scan-only", "prebuild": "npm run kb" } }
```

MIT licensed.
