#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledge, estimateTokens, KnowledgeError, OUTPUT_FILE } from '../src/build.js';

const HELP = `
petfolio-cli — turn a text file about you into the knowledge your Petfolio pet answers from

Usage
  npx petfolio-cli <file> [--out <dir>]

  <file>         a plain-text or Markdown file with your background, projects, FAQ …
                 (put the pet's personality under a "# Personality" heading — optional)
  --out <dir>    where to write ${OUTPUT_FILE} (default: public)
                 e.g. --out static (SvelteKit), --out src/assets (Angular)
  -v, --version  print the version
  -h, --help     show this help

Example
  npx petfolio-cli about-me.txt
`;

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NOT_TEXT = new Set(['.pdf', '.doc', '.docx', '.rtf', '.odt', '.pages']);

function usageError(message) {
  console.error(`${message}\n${HELP}`);
  process.exit(2);
}

function fail(message) {
  console.error(`petfolio-cli: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { file: null, out: 'public' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { console.log(HELP); process.exit(0); }
    else if (a === '-v' || a === '--version') {
      console.log(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version);
      process.exit(0);
    }
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a.startsWith('-')) usageError(`Unknown option: ${a}`);
    else if (args.file) usageError(`Only one input file is supported (got "${args.file}" and "${a}").`);
    else args.file = a;
  }
  if (!args.file) usageError('Missing the input file.');
  if (!args.out) usageError('--out needs a directory.');
  return args;
}

function readInput(file) {
  const ext = path.extname(file).toLowerCase();
  if (NOT_TEXT.has(ext)) fail(`${file} is not plain text. Save it as .txt or .md and run again.`);
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') fail(`File not found: ${file}`);
    if (err.code === 'EISDIR') fail(`${file} is a folder — pass a single text file (e.g. about-me.txt).`);
    fail(`Could not read ${file}: ${err.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const input = path.resolve(cwd, args.file);

  let result;
  try {
    result = buildKnowledge(readInput(input));
  } catch (err) {
    if (err instanceof KnowledgeError) fail(err.message);
    throw err;
  }

  const outPath = path.join(path.resolve(cwd, args.out), OUTPUT_FILE);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result.knowledge, null, 2) + '\n', 'utf-8');

  const { contentChars, personalityChars, sections } = result.stats;
  const rel = (p) => path.relative(cwd, p) || '.';
  const titles = result.knowledge.sections.map((x) => x.title);
  console.log(`petfolio-cli: ${rel(input)} -> ${rel(outPath)}`);
  console.log(`  facts        ${contentChars.toLocaleString('en-US')} characters (about ${estimateTokens('x'.repeat(contentChars)).toLocaleString('en-US')} tokens per question)`);
  console.log(`  sections     ${sections}: ${titles.slice(0, 8).join(' | ')}${titles.length > 8 ? ' | …' : ''}`);
  console.log(personalityChars
    ? `  personality  ${personalityChars.toLocaleString('en-US')} characters`
    : '  personality  none (add a "# Personality" section to give the pet a voice)');
  for (const w of result.warnings) console.warn(`WARNING: ${w}`);
  console.log(`Note: ${OUTPUT_FILE} is served publicly — visitors can read everything in it.`);
}

main();
