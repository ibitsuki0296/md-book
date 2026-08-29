#!/usr/bin/env node
// Fails if a raw colour literal appears in a component stylesheet. Colours are
// only allowed in tokens.css (the palette) and under styles/themes/ (themes).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'src/styles');

const ALLOW = new Set(['tokens.css']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/;

const offenders = [];
for (const file of readdirSync(stylesDir)) {
  if (!file.endsWith('.css') || ALLOW.has(file)) continue;
  const lines = readFileSync(join(stylesDir, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    // `color-mix(` is fine — it composes tokens, it is not a literal.
    const scrubbed = line.replace(/\bcolor-mix\s*\(/g, '');
    if (COLOR.test(scrubbed)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
  });
}

if (offenders.length > 0) {
  console.error('validate-tokens: raw colour literals found outside tokens.css:\n');
  for (const o of offenders) console.error(`  ${o}`);
  console.error('\nMove the colour into a --md-book-* token in tokens.css.');
  process.exit(1);
}

console.log('validate-tokens: ok — component styles use tokens only');
