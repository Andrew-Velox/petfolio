#!/usr/bin/env node
/**
 * sync-avatars.mjs — Build the data for the Avatars page from the repo's /avatars folder.
 *
 *   node scripts/sync-avatars.mjs        (runs automatically before `next dev` / `next build`)
 *
 * For every avatars/<name>/avatar.json it
 *   - copies the three walking frames (shime1–3.png) to public/avatar-previews/<name>/, and
 *   - writes app/avatars/avatars.generated.json (what the page renders).
 *
 * Both outputs are committed, so a build that cannot see ../avatars (a host that only checks out the
 * site/ folder) still works; it just keeps what was generated last time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.join(here, '..');
const avatarsDir = path.join(siteRoot, '..', 'avatars');
const previewsDir = path.join(siteRoot, 'public', 'avatar-previews');
const outFile = path.join(siteRoot, 'app', 'avatars', 'avatars.generated.json');
const PREVIEW_FRAMES = [1, 2, 3];

if (!fs.existsSync(avatarsDir)) {
  console.warn(`⚠ ${avatarsDir} not found — keeping the existing ${path.relative(siteRoot, outFile)}`);
  process.exit(0);
}

const avatars = [];
for (const entry of fs.readdirSync(avatarsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(avatarsDir, entry.name);
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'avatar.json'), 'utf8'));
  } catch (e) {
    console.error(`✗ ${entry.name}/avatar.json: ${e.message}`);
    process.exit(1);
  }
  const target = path.join(previewsDir, entry.name);
  fs.mkdirSync(target, { recursive: true });
  for (const n of PREVIEW_FRAMES) fs.copyFileSync(path.join(dir, `shime${n}.png`), path.join(target, `shime${n}.png`));
  avatars.push({
    name: entry.name,
    displayName: meta.displayName || entry.name,
    author: meta.author || '',
    bundled: meta.bundled === true,
    frames: PREVIEW_FRAMES,
  });
}

// the built-in default first, then alphabetical
avatars.sort((a, b) => Number(b.bundled) - Number(a.bundled) || a.name.localeCompare(b.name));

// drop previews of avatars that were removed
if (fs.existsSync(previewsDir)) {
  for (const old of fs.readdirSync(previewsDir)) {
    if (!avatars.some((a) => a.name === old)) fs.rmSync(path.join(previewsDir, old), { recursive: true, force: true });
  }
}

fs.writeFileSync(outFile, JSON.stringify(avatars, null, 2) + '\n');
console.log(`✓ ${avatars.length} avatar(s): ${avatars.map((a) => a.name).join(', ')}`);
