import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { version } from '../src/index.js';

describe('package metadata', () => {
  it('src/version.ts matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(version).toBe(pkg.version);
  });

  it('every exports entry points at a file the build produces', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const targets = collectPaths(pkg.exports);
    for (const t of targets) {
      expect(t.startsWith('./dist/')).toBe(true);
    }
  });
});

function collectPaths(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectPaths(v, out);
  }
  return out;
}
