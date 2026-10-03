# Petfolio chat server (Cloudflare Workers)

A static site (GitHub Pages) can't hold your AI key. This tiny Worker does: the page sends the question here,
the Worker adds the secret Groq/Gemini key and forwards it. Free plan: 100,000 requests a day, no credit card.
It behaves exactly like `site/app/api/petfolio/route.ts` (the Next.js version) — keep the two in sync.

## Deploy (automatic, from GitHub)

1. Create a free Cloudflare account. In **My Profile → API Tokens → Create Token** use the
   **Edit Cloudflare Workers** template. Copy the token. The **Account ID** is on the Workers & Pages page.
2. In the GitHub repo → **Settings → Secrets and variables → Actions → Secrets**, add
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `PETFOLIO_GROQ_API_KEY` (your key from
   <https://console.groq.com/keys>).
3. Push to `main` (or run **Deploy chat server (Cloudflare Worker)** from the Actions tab). The first run prints
   the Worker's address, like `https://petfolio-chat.<your-subdomain>.workers.dev`.
4. Open that address in a browser: `{"ok":true,"service":"petfolio-chat","configured":true}` means it works.
5. Add the GitHub repo **variable** (same page, *Variables* tab) `PETFOLIO_ENDPOINT` = that address, then re-run
   **Deploy site to GitHub Pages**. The chat button appears on the site.

## Deploy by hand

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put PETFOLIO_GROQ_API_KEY     # paste the key when asked
npx wrangler deploy
```

## Configure

`wrangler.toml` → `PETFOLIO_ALLOWED_ORIGINS`: the websites allowed to call the Worker from a browser
(origin only — `https://you.github.io`, no path, no trailing slash; comma-separated for several). Anything else
gets 403. Change it if your Pages address differs from `https://andrew-velox.github.io`.

Optional: `PETFOLIO_MODEL` overrides the default model (providers retire models — a 502 whose log says
`model_not_found` means it's time). Gemini works too: set the secret `PETFOLIO_GEMINI_API_KEY` instead.

## Try it locally

```bash
printf 'PETFOLIO_GROQ_API_KEY=gsk_...\n' > .dev.vars      # git-ignored
npx wrangler dev                                        # http://localhost:8787
npm test                                                # handler tests, no network or key needed
```

## Debugging

- `npx wrangler tail` streams the Worker's log. A provider error shows up as `[petfolio] <model> -> HTTP <code>: …`.
- `503 chat is not configured`: the secret isn't set. `403`: the page's address isn't in `PETFOLIO_ALLOWED_ORIGINS`.
- The rate limit (20 requests/minute per visitor) is kept in memory, per Worker instance. For a hard limit, add a
  Cloudflare **Rate limiting rule** (Security → WAF) on the Worker's address.
