import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateManifest, writeManifest } from '../src/cli/manifest.js';
import { assertManifest } from '../src/index.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'md-book-test-'));
  mkdirSync(join(dir, 'guide'), { recursive: true });
  mkdirSync(join(dir, '.hidden'), { recursive: true });
  mkdirSync(join(dir, 'node_modules'), { recursive: true });

  writeFileSync(join(dir, 'index.md'), '---\ntitle: Home\n---\n# Home\n');
  writeFileSync(join(dir, 'guide', '01-intro.md'), '---\ntitle: Intro\n---\nhi\n');
  writeFileSync(join(dir, 'guide', '02-setup.md'), '# Setup\n');
  writeFileSync(join(dir, 'guide', 'wip.md'), '---\ndraft: true\n---\nwip\n');
  writeFileSync(join(dir, 'notes.txt'), 'ignored, not markdown');
  writeFileSync(join(dir, '.hidden', 'secret.md'), '# nope');
  writeFileSync(join(dir, 'node_modules', 'pkg.md'), '# nope');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('generateManifest', () => {
  it('discovers Markdown files and resolves routes, skipping drafts by default', () => {
    const manifest = generateManifest({ contentDir: dir });
    expect(manifest.version).toBe(1);
    expect(manifest.entries.map((e) => e.path)).toEqual(['/', '/guide/intro', '/guide/setup']);
  });

  it('ignores non-markdown, dotfiles and node_modules', () => {
    const files = generateManifest({ contentDir: dir }).entries.map((e) => e.file);
    expect(files).not.toContain('notes.txt');
    expect(files.some((f) => f.includes('.hidden'))).toBe(false);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  });

  it('carries front matter, filename order, and mtime onto entries', () => {
    const intro = generateManifest({ contentDir: dir }).entries.find(
      (e) => e.path === '/guide/intro',
    );
    expect(intro?.frontMatter.title).toBe('Intro');
    expect(intro?.order).toBe(1);
    expect(typeof intro?.mtime).toBe('number');
  });

  it('can include drafts and apply a base path', () => {
    const manifest = generateManifest({ contentDir: dir, includeDrafts: true, base: '/docs/' });
    expect(manifest.base).toBe('/docs/');
    expect(manifest.entries.map((e) => e.path)).toContain('/docs/guide/wip');
  });

  it('records contentBase only when provided', () => {
    expect(generateManifest({ contentDir: dir }).contentBase).toBeUndefined();
    expect(
      generateManifest({ contentDir: dir, contentBase: 'https://cdn.example/raw' }).contentBase,
    ).toBe('https://cdn.example/raw');
  });
});

describe('writeManifest', () => {
  it('writes valid, well-formed JSON', () => {
    const out = join(dir, 'manifest.json');
    const { written } = writeManifest({ contentDir: dir, out });
    expect(written).toBe(out);
    const parsed = JSON.parse(readFileSync(out, 'utf8'));
    expect(() => assertManifest(parsed)).not.toThrow();
  });
});
