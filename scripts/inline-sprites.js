#!/usr/bin/env node
/**
 * inline-sprites.js
 *
 * Reads all PNG sprites from public/sprites/ and generates
 * src/sprites-inline.js with base64 data URLs so the published
 * NPM package is fully self-contained.
 *
 * Usage: node scripts/inline-sprites.js
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');
const spriteDir = join(root, 'public', 'sprites');
const outFile   = join(root, 'src', 'sprites-inline.js');

const files = readdirSync(spriteDir)
  .filter(f => f.endsWith('.png'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

console.log(`Inlining ${files.length} sprites...`);

const entries = files.map(f => {
  const buf = readFileSync(join(spriteDir, f));
  const b64 = buf.toString('base64');
  return `  '${f}': 'data:image/png;base64,${b64}'`;
});

const code = [
  '// Auto-generated — do not edit. Run `node scripts/inline-sprites.js` to regenerate.',
  'export const SPRITE_DATA = {',
  entries.join(',\n'),
  '};',
  '',
].join('\n');

writeFileSync(outFile, code, 'utf8');

const sizeKB = Math.round(Buffer.byteLength(code) / 1024);
console.log(`✓ Wrote ${outFile} (${sizeKB} KB, ${files.length} sprites)`);
