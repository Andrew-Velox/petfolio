/**
 * Tests for avatar loading helpers (characters/remote.js) and the avatar folder checker
 * (scripts/check-avatars.mjs, run in CI on pull requests).
 *
 *   node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_AVATAR_BASE, AVATAR_FRAMES, isValidAvatarName, avatarBaseUrl,
} from '../src/characters/remote.js';
import { CHARACTERS, DEFAULT_CHARACTER } from '../src/characters/characters.js';
import { checkAvatar, checkAvatars, FRAME_COUNT, MAX_FRAME_BYTES } from '../../../scripts/check-avatars.mjs';

const REPO_AVATARS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'avatars');

// ── names and URLs ──────────────────────────────────────────

test('avatar names: lowercase letters, digits and dashes only', () => {
  for (const ok of ['finn', 'an2', 'pixel-cat', 'a', '007']) assert.ok(isValidAvatarName(ok), ok);
  for (const bad of ['', 'Finn', 'a b', '../x', 'a/b', 'a.b', '-x', 'x'.repeat(33), 42, null, undefined, {}]) {
    assert.ok(!isValidAvatarName(bad), String(bad));
  }
});

test('avatarBaseUrl builds <base>/<name>/ and tolerates slashes and an empty base', () => {
  assert.equal(avatarBaseUrl(DEFAULT_AVATAR_BASE, 'an2'), 'https://cdn.jsdelivr.net/gh/Andrew-Velox/petfolio@main/avatars/an2/');
  assert.equal(avatarBaseUrl('https://cdn.example.com/a///', 'x'), 'https://cdn.example.com/a/x/');
  assert.equal(avatarBaseUrl('/avatars', 'x'), '/avatars/x/');
  assert.equal(avatarBaseUrl('', 'x'), `${DEFAULT_AVATAR_BASE}x/`);
  assert.equal(avatarBaseUrl(undefined, 'x'), `${DEFAULT_AVATAR_BASE}x/`);
  assert.throws(() => avatarBaseUrl(DEFAULT_AVATAR_BASE, '../etc'), /Invalid avatar name/);
});

test('the package bundles exactly one avatar, with every frame, and it is the default', () => {
  assert.deepEqual(Object.keys(CHARACTERS), [DEFAULT_CHARACTER]);
  const sprites = CHARACTERS[DEFAULT_CHARACTER].spriteData;
  for (let n = 1; n <= AVATAR_FRAMES; n++) assert.ok(sprites[`shime${n}.png`]?.startsWith('data:image/png;base64,'), `shime${n}.png`);
});

// ── the avatars in this repo ────────────────────────────────

test('every avatar in /avatars passes the checker, and the bundled default matches the bundle', () => {
  const { avatars, problems } = checkAvatars(REPO_AVATARS);
  assert.deepEqual(problems, []);
  assert.ok(avatars.includes(DEFAULT_CHARACTER));
  const meta = JSON.parse(fs.readFileSync(path.join(REPO_AVATARS, DEFAULT_CHARACTER, 'avatar.json'), 'utf8'));
  assert.equal(meta.bundled, true);
});

// ── the checker against bad folders ─────────────────────────

/** A valid square PNG of the given size (no external deps). */
function png(size, padBytes = 0) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const text = padBytes ? chunk('tEXt', Buffer.alloc(padBytes, 0x61)) : Buffer.alloc(0);
  return Buffer.concat([sig, chunk('IHDR', ihdr), text, chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

function makeAvatar(root, name, { meta = {}, size = 128, skip = [], extra = [], bigFrame = 0 } = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'avatar.json'), JSON.stringify({ name, displayName: 'Test', author: 'me', ...meta }));
  for (let n = 1; n <= FRAME_COUNT; n++) {
    if (skip.includes(n)) continue;
    fs.writeFileSync(path.join(dir, `shime${n}.png`), png(size, n === bigFrame ? MAX_FRAME_BYTES + 1000 : 0));
  }
  for (const f of extra) fs.writeFileSync(path.join(dir, f), 'x');
  return dir;
}

function withTmp(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'petfolio-avatars-'));
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('checker: a well-formed avatar has no problems', () => withTmp((root) => {
  assert.deepEqual(checkAvatar(makeAvatar(root, 'good-one')), []);
}));

test('checker: reports bad names, mismatching or missing metadata', () => withTmp((root) => {
  assert.match(checkAvatar(makeAvatar(root, 'Bad_Name')).join('\n'), /folder name must match/);
  assert.match(checkAvatar(makeAvatar(root, 'a', { meta: { name: 'b' } })).join('\n'), /must equal the folder name/);
  assert.match(checkAvatar(makeAvatar(root, 'c', { meta: { author: '' } })).join('\n'), /"author"/);
  const d = makeAvatar(root, 'd'); fs.unlinkSync(path.join(d, 'avatar.json'));
  assert.match(checkAvatar(d).join('\n'), /avatar\.json is missing/);
}));

test('checker: reports missing, non-PNG, non-square, too small/large and oversized frames', () => withTmp((root) => {
  assert.match(checkAvatar(makeAvatar(root, 'm', { skip: [7, 46] })).join('\n'), /shime7\.png is missing[\s\S]*shime46\.png is missing/);
  const notPng = makeAvatar(root, 'n'); fs.writeFileSync(path.join(notPng, 'shime3.png'), 'hello world, definitely not a png');
  assert.match(checkAvatar(notPng).join('\n'), /shime3\.png is not a PNG/);
  const wide = makeAvatar(root, 'w'); fs.writeFileSync(path.join(wide, 'shime2.png'), (() => { const b = png(128); b.writeUInt32BE(200, 16); return b; })());
  assert.match(checkAvatar(wide).join('\n'), /frames must be square/);
  assert.match(checkAvatar(makeAvatar(root, 'tiny', { size: 32 })).join('\n'), /must be 64–256 px/);
  assert.match(checkAvatar(makeAvatar(root, 'huge', { size: 300 })).join('\n'), /must be 64–256 px/);
  assert.match(checkAvatar(makeAvatar(root, 'fat', { bigFrame: 5 })).join('\n'), /shime5\.png is .* KB; the limit/);
  assert.match(checkAvatar(makeAvatar(root, 'junk', { extra: ['notes.txt', 'shime47.png'] })).join('\n'), /unexpected files: notes\.txt, shime47\.png/);
}));

test('checker: exactly one avatar must be the bundled default', () => withTmp((root) => {
  makeAvatar(root, 'one');
  assert.match(checkAvatars(root).problems.join('\n'), /exactly one avatar must be "bundled": true.*found 0/);
  fs.rmSync(path.join(root, 'one'), { recursive: true });
  makeAvatar(root, 'one', { meta: { bundled: true } });
  makeAvatar(root, 'two', { meta: { bundled: true } });
  assert.match(checkAvatars(root).problems.join('\n'), /found 2/);
  fs.rmSync(path.join(root, 'two'), { recursive: true });
  assert.deepEqual(checkAvatars(root).problems, []);
}));
