#!/usr/bin/env node
// After tsup:
//  1. concatenate the source stylesheets into dist/style.css (imports inlined)
//  2. copy the reference themes into dist/themes/
//  3. write a Subresource Integrity hash for the CDN bundle
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'src/styles');
const outDir = join(root, 'dist');
const version = readJson(join(root, 'package.json')).version ?? '0.0.0';

// --- 1 + 2: CSS -----------------------------------------------------------
const ORDER = ['tokens', 'base', 'layout', 'content', 'components'];
const layerDecl = `@layer ${ORDER.map((n) => `md-book.${n}`).join(', ')};\n`;
mkdirSync(join(outDir, 'themes'), { recursive: true });

const body = ORDER.map((name) => {
  const css = readFileSync(join(stylesDir, `${name}.css`), 'utf8').trimEnd();
  return `/* --- ${name}.css --- */\n${css}\n`;
}).join('\n');
writeFileSync(join(outDir, 'style.css'), `/*! md-book ${version} | MIT */\n${layerDecl}\n${body}`);

let themeCount = 0;
for (const file of readdirSync(join(stylesDir, 'themes'))) {
  if (!file.endsWith('.css')) continue;
  copyFileSync(join(stylesDir, 'themes', file), join(outDir, 'themes', file));
  themeCount++;
}

// --- 3: SRI for the CDN bundle ------------------------------------------
const bundle = join(outDir, 'md-book.global.js');
const hash = createHash('sha384').update(readFileSync(bundle)).digest('base64');
const integrity = `sha384-${hash}`;
writeFileSync(`${bundle}.sri`, `${integrity}\n`);

console.log(`postbuild: dist/style.css + ${themeCount} theme(s)`);
console.log(`postbuild: md-book.global.js integrity ${integrity}`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}
