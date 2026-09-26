#!/usr/bin/env node
// After tsup:
//  1. concatenate the source stylesheets into dist/style.css (imports inlined)
//  2. copy the reference themes into dist/themes/
//  3. write dist/THIRD_PARTY_LICENSES.txt for the packages bundled into dist
//  4. write a Subresource Integrity hash for the CDN bundle
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

// --- 3: third-party licenses ---------------------------------------------
// tsup writes a metafile for each bundling build (CDN IIFE, CJS); every
// node_modules package it lists ships inside dist, so its licence must too.
const bundled = new Set();
for (const file of readdirSync(outDir)) {
  if (!/^metafile-.*\.json$/.test(file)) continue;
  const meta = readJson(join(outDir, file));
  for (const input of Object.keys(meta.inputs ?? {})) {
    const at = input.lastIndexOf('node_modules/');
    if (at === -1) continue;
    const [first, second] = input.slice(at + 'node_modules/'.length).split('/');
    bundled.add(first?.startsWith('@') ? `${first}/${second}` : first);
  }
  rmSync(join(outDir, file));
}

const sections = [...bundled].sort().map((name) => {
  const dir = join(root, 'node_modules', name);
  const pkg = readJson(join(dir, 'package.json'));
  const licenseFile = readdirSync(dir).find((f) => /^licen[cs]e([-.].*)?$/i.test(f));
  if (!licenseFile) throw new Error(`postbuild: no LICENSE file found for bundled package ${name}`);
  const text = readFileSync(join(dir, licenseFile), 'utf8').trim();
  return `${name}@${pkg.version} (${pkg.license})\n${'-'.repeat(72)}\n${text}\n`;
});
writeFileSync(
  join(outDir, 'THIRD_PARTY_LICENSES.txt'),
  `md-book bundles the following third-party packages.\n\n${sections.join('\n')}`,
);

// --- 4: SRI for the CDN bundle ------------------------------------------
const bundle = join(outDir, 'md-book.global.js');
const hash = createHash('sha384').update(readFileSync(bundle)).digest('base64');
const integrity = `sha384-${hash}`;
writeFileSync(`${bundle}.sri`, `${integrity}\n`);

console.log(`postbuild: dist/style.css + ${themeCount} theme(s)`);
console.log(`postbuild: THIRD_PARTY_LICENSES.txt (${bundled.size} packages)`);
console.log(`postbuild: md-book.global.js integrity ${integrity}`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}
