#!/usr/bin/env node
/**
 * inline-sprites.js — Multi-character sprite bundler.
 *
 * Scans public/characters/<name>/ for character folders, reads each
 * character.json (if present) and inlines all shime{N}.png sprites
 * as base64 data URLs into src/characters/characters.js.
 *
 * Folder layout:
 *   public/characters/
 *     <name>/
 *       character.json   (optional — has displayName, frames mapping)
 *       shime1.png ...   (sprite frames, named the same across characters)
 *
 * character.json (all fields optional):
 *   {
 *     "name":        "an2",
 *     "displayName": "An2",
 *     "author":      "kypo",
 *     "frames": {
 *       "idle":      [1],
 *       "walk":      [1, 2, 3],
 *       "grab":      [13],
 *       ...
 *     }
 *   }
 *
 * If character.json is absent, the character is loaded with a default
 * frame mapping (same as the original single-character setup) and the
 * folder name is used as the display name.
 *
 * Usage: node scripts/inline-sprites.js
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');
const charsDir  = join(root, 'public', 'characters');
const outDir    = join(root, 'src', 'characters');
const outFile   = join(outDir, 'characters.js');

// Default frame mapping — used when a character folder has no
// character.json or no `frames` block. Mirrors the original
// single-character build so existing characters work out of the box.
const DEFAULT_FRAMES = {
  idle:                 [1],
  walk:                 [1, 2, 3],
  crawl:                [20, 21],
  grab:                 [12, 13, 14],
  sit:                  [31, 32, 33],
  peek:                 [20, 21],
  say_hi:               [34, 35],
  wave:                 [1, 42, 43, 1],
  crawl_top:            [23, 24, 25],
  jump:                 [22],
  falling:              [4],
  land:                 [18, 19, 1],
  summon_falling:       [4],
  summon_landed:        [18, 19, 1, 42, 43, 1],
  tv_clone:             [38, 39, 40, 41, 40, 39, 1],
  remove_cap:           [11, 15, 16, 17, 16, 1],
  held:                 [1],
  heldRightFast:        [9],
  heldRightTransition:  [9, 7, 5, 1],
  heldRightStill:       [1],
  heldLeftFast:         [8],
  heldLeftTransition:   [8, 6, 1],
  heldLeftStill:        [1],
};

function readCharacter(folderPath) {
  // Read character.json (optional)
  const manifestPath = join(folderPath, 'character.json');
  let meta = {};
  if (existsSync(manifestPath)) {
    try {
      meta = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      console.warn(`⚠ Failed to parse ${manifestPath}: ${e.message}`);
    }
  }

  // Inline all .png sprites
  const spriteFiles = readdirSync(folderPath)
    .filter(f => f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  const spriteData = {};
  for (const f of spriteFiles) {
    const buf = readFileSync(join(folderPath, f));
    spriteData[f] = `data:image/png;base64,${buf.toString('base64')}`;
  }

  // Merge frame mappings: character.json overrides defaults
  const frames = { ...DEFAULT_FRAMES, ...(meta.frames || {}) };
  // Strip the _doc field if present (it's just a comment)
  delete frames._doc;

  return {
    name:        meta.name        || '',
    displayName: meta.displayName || '',
    author:      meta.author      || '',
    spriteData,
    frames,
  };
}

function main() {
  if (!existsSync(charsDir)) {
    console.error(`✗ No characters directory at ${charsDir}`);
    console.error(`  Create public/characters/<name>/ with shime*.png files.`);
    process.exit(1);
  }

  const folders = readdirSync(charsDir)
    .filter(f => statSync(join(charsDir, f)).isDirectory());

  if (folders.length === 0) {
    console.error(`✗ No character folders found in ${charsDir}`);
    process.exit(1);
  }

  console.log(`Inlining ${folders.length} character(s)...`);

  const characters = {};
  let totalSprites = 0;

  for (const folder of folders) {
    const charPath = join(charsDir, folder);
    const char     = readCharacter(charPath);
    // Fall back to folder name if character.json didn't specify one
    if (!char.name)        char.name        = folder;
    if (!char.displayName) char.displayName = folder;
    characters[folder] = char;
    const spriteCount = Object.keys(char.spriteData).length;
    totalSprites += spriteCount;
    console.log(`  ✓ ${folder.padEnd(16)} ${char.displayName.padEnd(16)} ${spriteCount} sprites`);
  }

  // Sort by folder name for deterministic output
  const sorted = Object.keys(characters).sort().reduce((acc, k) => {
    acc[k] = characters[k];
    return acc;
  }, {});

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const code = [
    '// Auto-generated by scripts/inline-sprites.js — do not edit.',
    '// Regenerate with: node scripts/inline-sprites.js',
    '',
    'export const CHARACTERS = ' + JSON.stringify(sorted, null, 2) + ';',
    '',
    'export const DEFAULT_CHARACTER = ' + JSON.stringify(folders[0]) + ';',
    '',
    '/**',
    ' * Default frame mapping used when a character has no character.json',
    ' * or is missing a particular animation. Mirrors the shime1-46 layout.',
    ' */',
    'export const DEFAULT_FRAMES = ' + JSON.stringify(DEFAULT_FRAMES, null, 2) + ';',
    '',
  ].join('\n');

  writeFileSync(outFile, code, 'utf8');

  const sizeKB = Math.round(Buffer.byteLength(code) / 1024);
  console.log(`✓ Wrote ${outFile} (${sizeKB} KB, ${totalSprites} sprites across ${folders.length} characters)`);
}

main();
