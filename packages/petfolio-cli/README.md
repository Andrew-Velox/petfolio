# petfolio-cli

Turns **one text file about you** into the knowledge the [Petfolio](https://www.npmjs.com/package/petfolio)
pet answers from.

```bash
npx petfolio-cli about-me.txt                 # writes public/petfolio-knowledge.json
npx petfolio-cli about-me.txt --out static    # write somewhere else (SvelteKit: static, Angular: src/assets)
npx petfolio-cli --help
```

```
petfolio-cli: about-me.txt -> public/petfolio-knowledge.json
  facts        1,204 characters (about 301 tokens per question)
  sections     4: About me | Projects | Contact | …
  personality  96 characters
```

## The text file

Plain text or Markdown — your background, resume, projects, FAQ, how to contact you. Optionally, describe the
pet's voice under a heading called `Personality` (or `Persona`, any heading level):

```md
# About me
I'm Alex, a full-stack developer in Lisbon. I build web apps with TypeScript and Rust.

## Contact
Email alex@example.com. I usually reply within two days.

## Personality
Cheerful and a little shy. Speak in the first person and add a tiny emoji now and then.
```

The Personality section runs until the next heading of the same or a higher level.

**Use headings.** Each heading becomes a titled section; the AI uses the titles to find the right topic
(nested headings become `Projects > Petfolio`, text before the first heading is `About`). Write names, dates and
links exactly as they should be quoted. `<!-- HTML comments -->` are dropped, so you can keep private notes.

- **Keep it short.** The widget sends all of it with every question. Under ~8,000 characters is comfortable;
  the CLI warns above that and refuses above 20,000 (personality: 2,000).
- **It is public.** `petfolio-knowledge.json` is served from your site, so anyone can read it. Never put
  passwords or API keys in the text (the CLI warns if something looks like a key).
- Not for PDFs or Word files — save them as `.txt` / `.md` first.

## The output

```json
{
  "version": 2,
  "sections": [
    { "title": "About me", "text": "I'm Alex, a full-stack developer in Lisbon. …" },
    { "title": "Contact", "text": "Email alex@example.com. I usually reply within two days." }
  ],
  "personality": "Cheerful and a little shy. …"
}
```

Markdown clutter is cleaned out (`**bold**`, backticks, `[links](…)` → `links (…)`, images, rules) so the model
reads plain sentences. Same input, same bytes. No dependencies; nothing else in your project is read or changed.

## Using it

The widget fetches `/petfolio-knowledge.json` by default and sends the text, via **your own server route** that
adds the secret API key, to Groq or Gemini (both have free tiers). Run the CLI on every build to keep it fresh:

```json
{ "scripts": { "prebuild": "petfolio-cli about-me.txt" } }
```

Full setup (server route, API key, options, troubleshooting): see the
[Petfolio README](https://github.com/Andrew-Velox/petfolio#ai-chat).

MIT licensed.
