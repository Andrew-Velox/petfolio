/**
 * build.js — turn the developer's about-me text into the knowledge JSON.
 *
 * Pure functions (no file system, no process), so they are easy to test.
 *
 * Input: one plain-text / Markdown file. Optionally, the pet's personality goes
 * under a heading called "Personality" (any heading level; "Persona" works too):
 *
 *     # About me
 *     I'm Alex, a full-stack developer in Lisbon…
 *
 *     ## Personality
 *     Cheerful and a little shy. Ends answers with a tiny emoji.
 *
 * The section runs until the next heading of the same or a higher level.
 *
 * Output (what the widget fetches from /petfolio-knowledge.json) — organised so a
 * small AI model finds the right facts: one titled section per heading (nested
 * headings become "Parent > Child"), with Markdown noise cleaned out:
 *     { "version": 2,
 *       "sections": [ { "title": "Projects > Petfolio", "text": "…" }, … ],
 *       "personality": "…" }
 */

export const OUTPUT_FILE = 'petfolio-knowledge.json';
export const FORMAT_VERSION = 2;
export const DEFAULT_SECTION_TITLE = 'About';

// The widget sends ALL of `content` with every question, so it has to stay small.
// (Free AI tiers cap tokens per minute; one token is roughly 4 characters.)
export const WARN_CONTENT_CHARS = 8_000;
export const MAX_CONTENT_CHARS = 20_000;
export const MAX_PERSONALITY_CHARS = 2_000;

export class KnowledgeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KnowledgeError';
  }
}

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;
const PERSONALITY_TITLES = new Set([
  'personality', 'persona', 'pet personality', 'pet persona',
  'personality and tone', 'personality & tone',
]);

// The output is a public file. Warn (never block) when something looks like a credential.
const SECRET_PATTERNS = [
  [/\bgsk_[A-Za-z0-9]{20,}/, 'a Groq API key'],
  [/\bAIza[0-9A-Za-z_-]{30,}/, 'a Google API key'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'an API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
];

const fmt = (n) => n.toLocaleString('en-US');

/** BOM and CRLF out, trailing spaces off, runs of blank lines collapsed. */
export function normalizeText(text) {
  return String(text)
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isPersonalityHeading(title) {
  const t = String(title ?? '').replace(/[ \t]#+$/, '').replace(/:$/, '').trim().toLowerCase();
  return PERSONALITY_TITLES.has(t);
}

/** Split off the "Personality" section(s). Headings inside code fences are ignored. */
export function splitSections(text) {
  const content = [];
  const personality = [];
  let inPersonality = null;           // heading level of the open Personality section
  let inFence = false;

  for (const line of text.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const h = inFence ? null : HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      if (isPersonalityHeading(h[2])) {
        if (personality.length) personality.push('');
        inPersonality = level;
        continue;                      // the heading line itself is not part of the text
      }
      if (inPersonality !== null && level <= inPersonality) inPersonality = null;
    }
    (inPersonality !== null ? personality : content).push(line);
  }
  return {
    content: normalizeText(content.join('\n')),
    personality: normalizeText(personality.join('\n')),
  };
}

// ── Cleaning ────────────────────────────────────────────────
/** Inline Markdown → plain words: links keep their URL, emphasis and code ticks go. */
export function cleanInline(line) {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                                  // image → its alt text
    .replace(/\[([^\]]+)\]\(<?([^)>\s]+)>?(?:\s+"[^"]*")?\)/g, (_, text, url) => {  // [text](url) → text (url)
      const bare = url.replace(/^mailto:/, '');
      return text.trim() === bare || text.trim() === url ? bare : `${text} (${bare})`;
    })
    .replace(/\*\*(.+?)\*\*/g, '$1')                                            // **bold**
    .replace(/__(.+?)__/g, '$1')                                                // __bold__
    .replace(/(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1')                 // *italic*
    .replace(/`([^`]+)`/g, '$1')                                                // `code`
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Block-level clean-up: bullets become "- ", quotes and rules go. Code fences are kept verbatim. */
export function cleanMarkdown(text) {
  let inFence = false;
  const out = [];
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) { inFence = !inFence; continue; }          // drop the ``` markers, keep the code
    if (inFence) { out.push(line); continue; }
    if (/^ {0,3}([-*_])( *\1){2,} *$/.test(line)) continue;           // --- *** ___ rules
    const bullet = /^(\s*)[*+-][ \t]+(.*)$/.exec(line);
    const clean = cleanInline(line.replace(/^ {0,3}>[ \t]?/, ''));
    out.push(bullet ? `${bullet[1]}- ${cleanInline(bullet[2])}` : clean);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** <!-- notes to yourself --> never reach the (public) output. */
export function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

// ── Sections ────────────────────────────────────────────────
/**
 * One section per heading that has text under it. Nested headings give the
 * path as the title ("Projects > Petfolio"); a lone top-level title that only
 * names the whole document is left out of the path. Text before the first
 * heading becomes the section "About".
 * @returns {{title:string, text:string}[]}
 */
export function toSections(markdown) {
  const blocks = [];
  let cur = { level: 0, title: DEFAULT_SECTION_TITLE, lines: [] };
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const h = inFence ? null : HEADING.exec(line);
    if (h && h[2]) {
      blocks.push(cur);
      cur = { level: h[1].length, title: cleanInline(h[2].replace(/[ \t]#+$/, '')), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  blocks.push(cur);

  const headings = blocks.filter((b) => b.level > 0);
  const top = Math.min(...headings.map((b) => b.level));
  const roots = headings.filter((b) => b.level === top);
  const dropRoot = headings.length > 1 && roots.length === 1 && roots[0] === headings[0];

  const sections = [];
  const stack = [];
  for (const b of blocks) {
    let title = b.title;
    if (b.level > 0) {
      while (stack.length && stack.at(-1).level >= b.level) stack.pop();
      stack.push(b);
      const path = (dropRoot && stack.length > 1 ? stack.slice(1) : stack).map((x) => x.title);
      title = path.join(' > ');
    }
    const text = cleanMarkdown(b.lines.join('\n'));
    if (text) sections.push({ title, text });
  }
  return sections;
}

/** The exact text the widget builds from `sections` — used for the size limits. Keep in sync with petfolio's ai/knowledge.js. */
export function formatSections(sections) {
  return sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n');
}

/** Rough token count (about 4 characters per token for English). */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * @param {string} raw  the file's text
 * @returns {{ knowledge: {version:number, sections:{title:string,text:string}[], personality?:string},
 *             stats: {contentChars:number, personalityChars:number, sections:number},
 *             warnings: string[] }}
 * @throws {KnowledgeError} for empty / binary / oversized input
 */
export function buildKnowledge(raw) {
  if (typeof raw !== 'string') throw new KnowledgeError('Expected the file contents as text.');
  if (raw.includes('\u0000')) throw new KnowledgeError('This does not look like a text file (it contains binary data).');

  const { content: body, personality } = splitSections(stripComments(normalizeText(raw)));
  const sections = toSections(body);
  const content = formatSections(sections);   // what the widget will send, so limits count the real thing
  if (!content) {
    throw new KnowledgeError(
      personality
        ? 'The file only has a Personality section — add the facts about you / your site outside of it.'
        : 'The file is empty — write a few paragraphs about you or your site.',
    );
  }
  if (content.length > MAX_CONTENT_CHARS) {
    throw new KnowledgeError(
      `The text is ${fmt(content.length)} characters; the limit is ${fmt(MAX_CONTENT_CHARS)}. ` +
      'The pet sends all of it with every question, so keep only what visitors really ask about.',
    );
  }
  if (personality.length > MAX_PERSONALITY_CHARS) {
    throw new KnowledgeError(
      `The Personality section is ${fmt(personality.length)} characters; the limit is ${fmt(MAX_PERSONALITY_CHARS)}.`,
    );
  }

  const warnings = [];
  if (content.length > WARN_CONTENT_CHARS) {
    warnings.push(
      `The text is long (${fmt(content.length)} characters, about ${fmt(estimateTokens(content))} tokens). ` +
      'It is sent with every question — on free AI tiers that means few questions per minute. Shorter is better.',
    );
  }
  for (const [pattern, what] of SECRET_PATTERNS) {
    if (pattern.test(content) || pattern.test(personality)) {
      warnings.push(`The text contains what looks like ${what}. The output file is public — remove it from the source file.`);
    }
  }

  const knowledge = { version: FORMAT_VERSION, sections };
  if (personality) knowledge.personality = personality;
  return {
    knowledge,
    stats: { contentChars: content.length, personalityChars: personality.length, sections: sections.length },
    warnings,
  };
}
