/**
 * ai/knowledge.js — Load the knowledge file made by petfolio-cli.
 *
 * `npx petfolio-cli about-me.txt` writes `public/petfolio-knowledge.json`:
 *
 *     { "version": 2,
 *       "sections": [ { "title": "Projects > Petfolio", "text": "…" }, … ],
 *       "personality": "…optional…" }
 *
 * The widget fetches it once, keeps it in memory, turns the sections into one
 * titled text and sends ALL of it with every question ("context stuffing"). There is no search, no embeddings
 * and nothing to index — which is why the file is kept small (see the limits).
 *
 * Pure functions only (no DOM), so it runs under Node for tests.
 */

export const DEFAULT_KNOWLEDGE_URL = '/petfolio-knowledge.json';

// Keep in sync with petfolio-cli (src/build.js) — it refuses to write bigger files.
export const MAX_CONTENT_CHARS = 20000;
export const MAX_PERSONALITY_CHARS = 2000;

const EMPTY = Object.freeze({ content: '', personality: '', topics: [], truncated: false });

/** `sections` → the text sent to the model. Keep in sync with petfolio-cli (src/build.js, formatSections). */
export function formatSections(sections) {
  return sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n');
}

/**
 * Accept the CLI's object (`sections`), an object with a plain `content` string, or a plain
 * string. Anything else — including the old array format — gives an empty result.
 * @returns {{content:string, personality:string, topics:string[], truncated:boolean}}
 */
export function normalizeKnowledge(raw) {
  const o = typeof raw === 'string' ? { content: raw } : raw;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ...EMPTY, topics: [] };
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  const sections = Array.isArray(o.sections)
    ? o.sections
        .map((s) => ({ title: text(s?.title), text: text(s?.text) }))
        .filter((s) => s.title && s.text)
    : [];
  const content = sections.length ? formatSections(sections) : text(o.content);
  const personality = text(o.personality);
  return {
    content: content.slice(0, MAX_CONTENT_CHARS),
    personality: personality.slice(0, MAX_PERSONALITY_CHARS),
    topics: [...new Set(sections.map((s) => s.title))],
    truncated: content.length > MAX_CONTENT_CHARS || personality.length > MAX_PERSONALITY_CHARS,
  };
}

/** A URL or path — as opposed to the knowledge text itself (which has spaces / newlines). */
const looksLikeUrl = (s) => typeof s === 'string' && /^(\/|\.\.?\/|https?:\/\/)\S*$/.test(s);

/**
 * Resolve the `knowledge` option: a URL (default `/petfolio-knowledge.json`),
 * or the data itself. A missing or broken file yields empty knowledge plus
 * `loadError`, so the caller can warn the developer and retry later.
 */
export async function loadKnowledge(source = DEFAULT_KNOWLEDGE_URL, fetchImpl = globalThis.fetch) {
  if (!looksLikeUrl(source)) return normalizeKnowledge(source);
  try {
    // no-cache = always revalidate (a cheap 304), so a redeploy is picked up on the next page load
    const res = await fetchImpl(source, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return normalizeKnowledge(await res.json());
  } catch (err) {
    return { ...EMPTY, topics: [], loadError: err };
  }
}
