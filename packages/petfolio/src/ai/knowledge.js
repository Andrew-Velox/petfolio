/**
 * ai/knowledge.js — Load and search the knowledge base made by petfolio-cli.
 *
 * The CLI writes `public/petfolio-knowledgeBase.json`:
 *     [ { "source": "src/pages/about.jsx", "content": "…prose…" }, … ]
 *
 * Free-tier models have small context/rate limits, so we never send the
 * whole file. Each question is answered from the few chunks that match it:
 *
 *   1. split every entry into ~500-char chunks on sentence boundaries
 *   2. score chunks against the question (TF·IDF over plain words, with a
 *      small bonus when the file path itself matches)
 *   3. return the best few, capped at a character budget
 *
 * No embeddings, no network, no dependencies — works offline and is tiny.
 * Pure functions only (no DOM), so it runs under Node for tests.
 */

const STOPWORDS = new Set((
  'a an and are as at be but by can do does for from has have how i if in is it its me my of on or our ' +
  'so that the their them then there these they this to us was we what when where which who why will with ' +
  'you your about tell please hi hello hey'
).split(' '));

/** lowercase words, light plural stemming, stopwords removed */
export function tokenize(text) {
  const words = String(text).toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [];
  const out = [];
  for (let w of words) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    out.push(w);
  }
  return out;
}

/** Accept the CLI array, `{ entries: [...] }`, or a plain string. */
export function normalizeKnowledge(raw) {
  let list = raw;
  if (typeof raw === 'string') list = [{ source: 'knowledge', content: raw }];
  else if (raw && !Array.isArray(raw) && Array.isArray(raw.entries)) list = raw.entries;
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.content === 'string' && e.content.trim())
    .map((e) => ({ source: String(e.source ?? 'knowledge'), content: e.content.trim() }));
}

/** Pack sentences into chunks of at most `size` chars (long sentences are hard-split). */
export function chunkText(text, size = 500) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let cur = '';
  const push = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  for (const s of sentences) {
    if (s.length > size) {
      push();
      for (let i = 0; i < s.length; i += size) chunks.push(s.slice(i, i + size));
    } else if ((cur + ' ' + s).length > size) {
      push();
      cur = s;
    } else {
      cur = cur ? cur + ' ' + s : s;
    }
  }
  push();
  return chunks;
}

export class KnowledgeIndex {
  /** @param {{source:string, content:string}[]} entries */
  constructor(entries, { chunkSize = 500 } = {}) {
    this.chunks = [];
    for (const e of normalizeKnowledge(entries)) {
      const pathTerms = new Set(tokenize(e.source.replace(/[/\\._-]+/g, ' ')));
      chunkText(e.content, chunkSize).forEach((text, i) => {
        const tf = new Map();
        for (const t of tokenize(text)) tf.set(t, (tf.get(t) || 0) + 1);
        this.chunks.push({ source: e.source, text, tf, pathTerms, first: i === 0 });
      });
    }
    // document frequency for IDF
    this.df = new Map();
    for (const c of this.chunks) for (const t of c.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }

  get size() { return this.chunks.length; }

  idf(term) {
    return Math.log(1 + this.chunks.length / (1 + (this.df.get(term) || 0)));
  }

  /**
   * Best chunks for a question.
   * @returns {{source:string, text:string, score:number}[]}
   */
  search(query, { limit = 5, maxChars = 3000 } = {}) {
    const terms = [...new Set(tokenize(query))];
    const scored = [];
    for (const c of this.chunks) {
      let score = 0;
      for (const t of terms) {
        const f = c.tf.get(t) || 0;
        if (f) score += (f / (f + 1.2)) * this.idf(t);
        if (c.pathTerms.has(t)) score += 0.5 * this.idf(t);
      }
      if (score > 0) scored.push({ source: c.source, text: c.text, score });
    }
    scored.sort((a, b) => b.score - a.score);

    let picked = scored;
    if (!picked.length) {
      // Generic question ("who are you?", "hi"): give a short overview —
      // the opening chunk of up to `limit` different files.
      const seen = new Set();
      picked = this.chunks
        .filter((c) => c.first && !seen.has(c.source) && seen.add(c.source))
        .map((c) => ({ source: c.source, text: c.text, score: 0 }));
    }

    const out = [];
    let used = 0;
    for (const c of picked) {
      if (out.length >= limit) break;
      if (used + c.text.length > maxChars && out.length) continue;
      out.push(c);
      used += c.text.length;
    }
    return out;
  }
}

/**
 * Resolve the `knowledge` option: a URL, an inline array/object/string,
 * or a ready KnowledgeIndex. A missing/broken file yields an empty index.
 */
export async function loadKnowledge(source, fetchImpl = globalThis.fetch) {
  if (source instanceof KnowledgeIndex) return source;
  const isUrl = typeof source === 'string' && /^(\/|\.|https?:)/.test(source);
  if (!isUrl) return new KnowledgeIndex(normalizeKnowledge(source));
  try {
    const res = await fetchImpl(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new KnowledgeIndex(normalizeKnowledge(await res.json()));
  } catch (err) {
    const idx = new KnowledgeIndex([]);
    idx.loadError = err;
    return idx;
  }
}
