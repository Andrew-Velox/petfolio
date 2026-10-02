#!/usr/bin/env node
/**
 * Copies the repo's LICENSE (and, with --readme, the root README) into the package
 * being published, so the npm page shows them. Run from a package directory:
 *
 *   node ../../scripts/sync-package-docs.mjs [--readme]
 *
 * The copies are git-ignored (see .gitignore); the files at the repo root stay the source of truth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copy = (name) => {
  fs.copyFileSync(path.join(root, name), path.join(process.cwd(), name));
  console.log(`synced ${name} → ${path.basename(process.cwd())}/`);
};

copy('LICENSE');
if (process.argv.includes('--readme')) copy('README.md');
