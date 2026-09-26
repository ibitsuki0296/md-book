#!/usr/bin/env node
// Run by `npm run version` after `changeset version`: copies package.json's version into
// src/version.ts (test/meta.test.ts requires them to match).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const file = join(root, 'src/version.ts');
const before = readFileSync(file, 'utf8');
const after = before.replace(
  /export const version = '[^']*';/,
  `export const version = '${version}';`,
);
if (after === before && !before.includes(`'${version}'`)) {
  throw new Error('sync-version: could not find the version constant in src/version.ts');
}
writeFileSync(file, after);
console.log(`sync-version: src/version.ts -> ${version}`);
