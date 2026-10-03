/** node --test test/  — text file -> knowledge JSON (pure functions + the real CLI binary). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildKnowledge, splitSections, normalizeText, formatSections, KnowledgeError,
  MAX_CONTENT_CHARS, MAX_PERSONALITY_CHARS, WARN_CONTENT_CHARS, FORMAT_VERSION,
} from '../src/build.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'index.js');

test('plain text becomes one "About" section — no personality key when there is none', () => {
  const { knowledge, stats, warnings } = buildKnowledge('I am Alex.\nI build pets.\n');
  assert.deepEqual(knowledge, { version: FORMAT_VERSION, sections: [{ title: 'About', text: 'I am Alex.\nI build pets.' }] });
  assert.equal('personality' in knowledge, false);
  assert.equal(stats.sections, 1);
  assert.equal(stats.contentChars, '## About\nI am Alex.\nI build pets.'.length);
  assert.deepEqual(warnings, []);
});

test('one titled section per heading; nested headings give "Parent > Child"; empty parents are skipped', () => {
  const { knowledge } = buildKnowledge([
    'Hi, I am Alex.',
    '## Projects', '### Petfolio', 'A pet for sites.', '### Mocap RS', 'Motion capture.',
    '## Contact', 'alex@example.com',
  ].join('\n'));
  assert.deepEqual(knowledge.sections.map((s) => s.title), ['About', 'Projects > Petfolio', 'Projects > Mocap RS', 'Contact']);
  assert.equal(knowledge.sections[1].text, 'A pet for sites.');
});

test('a lone top-level document title is left out of the paths, but its own text is kept', () => {
  const { knowledge } = buildKnowledge('# Alex\nIntro.\n## Projects\nPetfolio.\n### Details\nMore.');
  assert.deepEqual(knowledge.sections.map((s) => s.title), ['Alex', 'Projects', 'Projects > Details']);
  // two top-level headings: nothing is dropped
  const two = buildKnowledge('# Work\nA.\n## Projects\nB.\n# Life\nC.').knowledge;
  assert.deepEqual(two.sections.map((s) => s.title), ['Work', 'Work > Projects', 'Life']);
});

test('Markdown noise is cleaned: emphasis, code ticks, links keep their URL, images, bullets, rules, quotes', () => {
  const { knowledge } = buildKnowledge([
    '## Me',
    "I'm **Alex**, a *full-stack* dev who loves `Rust` and snake_case names.",
    'See [my site](https://alex.dev), [https://a.b](https://a.b) and [mail](mailto:a@x.com). ![logo](l.png)',
    '* one', '+ two', '- three', '> quoted', '---', '1. first',
  ].join('\n'));
  assert.equal(knowledge.sections[0].text, [
    "I'm Alex, a full-stack dev who loves Rust and snake_case names.",
    'See my site (https://alex.dev), https://a.b and mail (a@x.com). logo',
    '- one', '- two', '- three', 'quoted', '1. first',
  ].join('\n'));
});

test('code blocks are kept verbatim (without the fences); headings inside them are not sections', () => {
  const { knowledge } = buildKnowledge('## Setup\nRun:\n```\n# install\nnpm i **x**\n```\nDone.');
  assert.equal(knowledge.sections.length, 1);
  assert.equal(knowledge.sections[0].text, 'Run:\n# install\nnpm i **x**\nDone.');
});

test('<!-- comments --> are removed, even over several lines', () => {
  const { knowledge } = buildKnowledge('Public.\n<!-- TODO secret\nmore -->\n## A\nB.');
  assert.ok(!JSON.stringify(knowledge).includes('secret'));
  assert.equal(knowledge.sections.length, 2);
});

test('normalizeText: BOM, CRLF, trailing spaces and blank-line runs', () => {
  assert.equal(normalizeText('﻿a  \r\n\r\n\r\n\r\nb\t\r\n'), 'a\n\nb');
});

test('a Personality heading is split off, in any heading level and spelling', () => {
  for (const heading of ['# Personality', '## personality', '### Persona:', '## Pet Personality ##', '# Personality and tone']) {
    const { knowledge } = buildKnowledge(`About me.\n\n${heading}\nCheerful and shy.\n`);
    assert.equal(knowledge.sections.map((s) => s.text).join('|'), 'About me.', heading);
    assert.equal(knowledge.personality, 'Cheerful and shy.', heading);
  }
});

test('the Personality section ends at the next heading of the same or a higher level', () => {
  const text = [
    '# About', 'Facts A.',
    '## Personality', 'Playful.', '### Voice', 'Short sentences.',
    '## Projects', 'Facts B.',
    '# Contact', 'Facts C.',
  ].join('\n');
  const { content, personality } = splitSections(text);
  assert.equal(personality, 'Playful.\n### Voice\nShort sentences.');
  assert.equal(content, '# About\nFacts A.\n## Projects\nFacts B.\n# Contact\nFacts C.');
});

test('a Personality section at the end of the file, and several sections are joined', () => {
  const { personality, content } = splitSections('Facts.\n# Personality\nOne.\n# More\nFacts 2.\n# Persona\nTwo.');
  assert.equal(personality, 'One.\n\nTwo.');
  assert.equal(content, 'Facts.\n# More\nFacts 2.');
});

test('headings inside code fences and ordinary words are not mistaken for a Personality section', () => {
  const text = 'Facts.\n```\n# Personality\nnot a heading\n```\nMy personality is calm.\nPersonality\n#hashtag';
  const { content, personality } = splitSections(text);
  assert.equal(personality, '');
  assert.equal(content, text);
});

test('empty, whitespace-only and personality-only files are rejected with a helpful message', () => {
  assert.throws(() => buildKnowledge('  \n\n '), KnowledgeError);
  assert.throws(() => buildKnowledge('# Personality\nShy.'), /only has a Personality section/);
});

test('binary data is rejected', () => {
  assert.throws(() => buildKnowledge('PK\u0000\u0003binary'), /not look like a text file/);
});

test('size limits: warn when long, fail when over the maximum', () => {
  const long = buildKnowledge('x'.repeat(WARN_CONTENT_CHARS + 1));
  assert.equal(long.warnings.length, 1);
  assert.match(long.warnings[0], /sent with every question/);
  assert.throws(() => buildKnowledge('x'.repeat(MAX_CONTENT_CHARS + 1)), /limit is 20,000/);
  assert.doesNotThrow(() => buildKnowledge('x'.repeat(MAX_CONTENT_CHARS - '## About\n'.length)), 'the limit counts the formatted text the widget sends');
  assert.throws(() => buildKnowledge(`Facts.\n# Personality\n${'y'.repeat(MAX_PERSONALITY_CHARS + 1)}`), /Personality section/);
});

test('credentials in the text produce a warning (the output file is public) but do not block', () => {
  const { warnings } = buildKnowledge(`Contact me. key: gsk_${'a'.repeat(30)}`);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Groq API key/);
  assert.equal(buildKnowledge('-----BEGIN RSA PRIVATE KEY-----\nabc').warnings.length, 1);
  assert.deepEqual(buildKnowledge('I like skiing and sk-ills.').warnings, []);
});

test('non-Latin text and emoji pass through untouched', () => {
  const text = 'আমি মোহাব্বত। 東京 ☕ café';
  assert.equal(buildKnowledge(text).knowledge.sections[0].text, text);
});

// ── the real binary ────────────────────────────────────────
function cli(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf-8' });
}

test('CLI: writes public/petfolio-knowledge.json and reports what it did', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petfolio-cli-'));
  fs.writeFileSync(path.join(dir, 'about-me.txt'), 'I am Alex.\n\n## Personality\nShy.\n');
  const r = cli(['about-me.txt'], dir);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(dir, 'public', 'petfolio-knowledge.json'), 'utf-8'));
  assert.deepEqual(out, { version: 2, sections: [{ title: 'About', text: 'I am Alex.' }], personality: 'Shy.' });
  assert.match(r.stdout, /about-me\.txt -> public\/petfolio-knowledge\.json/);
  assert.match(r.stdout, /sections +1: About/);
  assert.match(r.stdout, /served publicly/);
});

test('CLI: --out writes elsewhere; same input gives byte-identical output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petfolio-cli-'));
  fs.writeFileSync(path.join(dir, 'a.md'), 'Hello.');
  assert.equal(cli(['a.md', '--out', 'static/data'], dir).status, 0);
  const file = path.join(dir, 'static', 'data', 'petfolio-knowledge.json');
  const first = fs.readFileSync(file);
  assert.equal(cli(['a.md', '--out=static/data'], dir).status, 0);
  assert.deepEqual(fs.readFileSync(file), first);
});

test('CLI: clear errors and exit codes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petfolio-cli-'));
  fs.writeFileSync(path.join(dir, 'empty.txt'), '\n');
  fs.writeFileSync(path.join(dir, 'cv.pdf'), '%PDF');
  fs.mkdirSync(path.join(dir, 'folder'));

  let r = cli([], dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Missing the input file/);
  r = cli(['--scan-only'], dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Unknown option/);
  r = cli(['a.txt', 'b.txt'], dir);
  assert.equal(r.status, 2);
  r = cli(['nope.txt'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /File not found/);
  r = cli(['folder'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /folder/);
  r = cli(['cv.pdf'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not plain text/);
  r = cli(['empty.txt'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /empty/);
  assert.equal(fs.existsSync(path.join(dir, 'public')), false, 'nothing is written on failure');
});

test('CLI: --help and --version exit 0', () => {
  assert.equal(cli(['--help'], os.tmpdir()).status, 0);
  assert.match(cli(['-v'], os.tmpdir()).stdout, /^\d+\.\d+\.\d+/);
});

// The CLI counts limits on the text the widget will build; the two formatters must never drift apart.
test('formatSections matches the widget\'s formatter (monorepo only)', async (t) => {
  const widget = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'petfolio', 'src', 'ai', 'knowledge.js');
  if (!fs.existsSync(widget)) return t.skip('petfolio package not next to this one');
  const { formatSections: theirs, normalizeKnowledge } = await import(widget);
  const { knowledge } = buildKnowledge('Intro.\n## A\nOne.\n### B\nTwo.\n## C\nThree.');
  assert.equal(formatSections(knowledge.sections), theirs(knowledge.sections));
  assert.equal(normalizeKnowledge(knowledge).content, formatSections(knowledge.sections));
});
