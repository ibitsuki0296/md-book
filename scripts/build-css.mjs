#!/usr/bin/env node
// Concatenates the source stylesheets into dist/style.css (imports inlined) and
// copies the reference themes into dist/themes/.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'src/styles');
const outDir = join(root, 'dist');

const ORDER = ['tokens', 'base', 'layout', 'content', 'components'];
const LAYER_DECL = `@layer ${ORDER.map((n) => `md-book.${n}`).join(', ')};\n`;

mkdirSync(join(outDir, 'themes'), { recursive: true });

const banner = `/*! md-book ${readPkgVersion()} | MIT | https://github.com/ (set repo) */\n`;
const body = ORDER.map((name) => {
  const css = readFileSync(join(stylesDir, `${name}.css`), 'utf8').trimEnd();
  return `/* --- ${name}.css --- */\n${css}\n`;
}).join('\n');

writeFileSync(join(outDir, 'style.css'), `${banner}${LAYER_DECL}\n${body}`);

let themeCount = 0;
for (const file of readdirSync(join(stylesDir, 'themes'))) {
  if (!file.endsWith('.css')) continue;
  copyFileSync(join(stylesDir, 'themes', file), join(outDir, 'themes', file));
  themeCount++;
}

console.log(`build-css: wrote dist/style.css + ${themeCount} theme(s)`);

function readPkgVersion() {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
