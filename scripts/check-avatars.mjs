#!/usr/bin/env node
/**
 * check-avatars.mjs — Validate the avatar folders in /avatars (run in CI on pull requests).
 *
 *   node scripts/check-avatars.mjs [avatarsDir]
 *
 * Every folder avatars/<name>/ must contain:
 *   avatar.json   { "name": "<name>", "displayName": "…", "author": "…", "bundled"?: true }
 *   shime1.png … shime46.png   one PNG per animation frame, 64–320 px wide and tall (not necessarily square), ≤ 40 KB each
 *
 * Folder names are what site owners type into `character: '…'`, so they must be
 * lowercase letters, digits and dashes. An avatar may weigh at most 1.5 MB in total.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAME_COUNT = 46;
export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const MAX_FRAME_BYTES = 40 * 1024;
export const MAX_TOTAL_BYTES = 1.5 * 1024 * 1024;
export const MIN_SIZE = 64;
export const MAX_SIZE = 320;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** @returns {string[]} problems found in one avatar folder (empty = fine) */
export function checkAvatar(dir) {
  const name = path.basename(dir);
  const problems = [];
  const fail = (msg) => problems.push(`${name}: ${msg}`);

  if (!NAME_PATTERN.test(name)) fail(`folder name must match ${NAME_PATTERN} (lowercase letters, digits, dashes)`);

  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'avatar.json'), 'utf8'));
  } catch (e) {
    fail(`avatar.json is missing or not valid JSON (${e.code ?? e.message})`);
  }
  if (meta) {
    if (meta.name !== name) fail(`avatar.json "name" is "${meta.name}", it must equal the folder name "${name}"`);
    for (const key of ['displayName', 'author']) {
      if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`avatar.json needs a non-empty "${key}"`);
    }
    if (meta.bundled !== undefined && typeof meta.bundled !== 'boolean') fail('avatar.json "bundled" must be true or false');
  }

  let total = 0;
  for (let n = 1; n <= FRAME_COUNT; n++) {
    const file = `shime${n}.png`;
    let buf;
    try { buf = fs.readFileSync(path.join(dir, file)); } catch { fail(`${file} is missing`); continue; }
    total += buf.length;
    if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) { fail(`${file} is not a PNG`); continue; }
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w < MIN_SIZE || w > MAX_SIZE || h < MIN_SIZE || h > MAX_SIZE) fail(`${file} is ${w}×${h}; width and height must be ${MIN_SIZE}–${MAX_SIZE} px`);
    if (buf.length > MAX_FRAME_BYTES) fail(`${file} is ${(buf.length / 1024).toFixed(1)} KB; the limit is ${MAX_FRAME_BYTES / 1024} KB`);
  }
  if (total > MAX_TOTAL_BYTES) fail(`frames total ${(total / 1024 / 1024).toFixed(2)} MB; the limit is ${MAX_TOTAL_BYTES / 1024 / 1024} MB`);

  const extras = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f !== 'avatar.json' && !/^shime([1-9]|[1-3][0-9]|4[0-6])\.png$/.test(f))
    : [];
  if (extras.length) fail(`unexpected files: ${extras.join(', ')}`);
  return problems;
}

/** @returns {{avatars: string[], problems: string[]}} */
export function checkAvatars(root) {
  const avatars = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const problems = [];
  if (!avatars.length) problems.push(`no avatar folders found in ${root}`);
  for (const name of avatars) problems.push(...checkAvatar(path.join(root, name)));
  const bundled = avatars.filter((n) => {
    try { return JSON.parse(fs.readFileSync(path.join(root, n, 'avatar.json'), 'utf8')).bundled === true; } catch { return false; }
  });
  if (avatars.length && bundled.length !== 1) problems.push(`exactly one avatar must be "bundled": true (the default); found ${bundled.length}`);
  return { avatars, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'avatars'));
  const { avatars, problems } = checkAvatars(root);
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(`✓ ${avatars.length} avatar(s) OK: ${avatars.join(', ')}`);
}
