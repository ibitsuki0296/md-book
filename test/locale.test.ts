import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateManifest } from '../src/cli/manifest.js';
import { createSiteModel } from '../src/core/site-model.js';
import {
  BLOG_DEFAULTS,
  MANIFEST_VERSION,
  type Manifest,
  alternatesOf,
  assertManifest,
  buildNav,
  entriesForLocale,
  localeOfRoute,
  localePrefix,
  localizeBlogConfig,
  localizeRoute,
  makeEntry,
  normalizeLocales,
  stripLocale,
  stripManifestBase,
} from '../src/index.js';

const setup = normalizeLocales(['en', { code: 'ja', label: '日本語!' }, 'pt-br'], 'en')!;

describe('normalizeLocales', () => {
  it('returns null unless there are two or more locales', () => {
    expect(normalizeLocales(undefined)).toBeNull();
    expect(normalizeLocales([])).toBeNull();
    expect(normalizeLocales(['en'])).toBeNull();
  });

  it('fills labels and picks the default (first unless given)', () => {
    expect(setup.defaultLocale).toBe('en');
    expect(setup.locales.map((l) => l.label)).toEqual(['English', '日本語!', 'Português']);
    expect(normalizeLocales(['en', 'ja'], 'JA')?.defaultLocale).toBe('ja');
  });

  it('rejects bad codes, duplicates and unknown defaults', () => {
    expect(() => normalizeLocales(['en', '../x'])).toThrow(/invalid locale/);
    expect(() => normalizeLocales(['en', 'EN'])).toThrow(/duplicate/);
    expect(() => normalizeLocales(['en', 'ja'], 'fr')).toThrow(/default locale/);
  });
});

describe('locale routing', () => {
  it('detects the locale from the first route segment', () => {
    expect(localeOfRoute('/', setup)).toBe('en');
    expect(localeOfRoute('/guide/x', setup)).toBe('en');
    expect(localeOfRoute('/ja', setup)).toBe('ja');
    expect(localeOfRoute('/ja/guide/x', setup)).toBe('ja');
    expect(localeOfRoute('/pt-br/a', setup)).toBe('pt-br');
    expect(localeOfRoute('/jack', setup)).toBe('en'); // whole segment only
    expect(localeOfRoute('/en/x', setup)).toBe('en'); // default locale has no prefix
  });

  it('strips and applies prefixes', () => {
    expect(stripLocale('/ja/guide/x', setup)).toBe('/guide/x');
    expect(stripLocale('/ja', setup)).toBe('/');
    expect(stripLocale('/guide', setup)).toBe('/guide');
    expect(localePrefix('en', setup)).toBe('');
    expect(localePrefix('ja', setup)).toBe('/ja');
    expect(localizeRoute('/guide/x', 'ja', setup)).toBe('/ja/guide/x');
    expect(localizeRoute('/ja/guide/x', 'en', setup)).toBe('/guide/x');
    expect(localizeRoute('/ja/guide/x', 'pt-br', setup)).toBe('/pt-br/guide/x');
    expect(localizeRoute('/', 'ja', setup)).toBe('/ja');
    expect(localizeRoute('/ja', 'en', setup)).toBe('/');
  });

  it('localises blog routes', () => {
    expect(localizeBlogConfig(BLOG_DEFAULTS, '')).toBe(BLOG_DEFAULTS);
    expect(localizeBlogConfig(BLOG_DEFAULTS, '/ja')).toMatchObject({
      dir: 'ja/blog',
      tagsBase: '/ja/tags',
      categoriesBase: '/ja/categories',
    });
  });
});

const entries = [
  makeEntry('index.md', { title: 'Home' }),
  makeEntry('guide/01-a.md', { title: 'A' }),
  makeEntry('guide/02-b.md', { title: 'B' }),
  makeEntry('ja/index.md', { title: 'ホーム' }),
  makeEntry('ja/guide/01-a.md', { title: 'えー' }),
];

describe('entry filtering', () => {
  it('splits entries by locale', () => {
    expect(entriesForLocale(entries, 'en', setup).map((e) => e.path)).toEqual([
      '/',
      '/guide/a',
      '/guide/b',
    ]);
    expect(entriesForLocale(entries, 'ja', setup).map((e) => e.path)).toEqual([
      '/ja',
      '/ja/guide/a',
    ]);
  });

  it('lists translations that exist', () => {
    const has = (r: string) => entries.some((e) => e.path === r);
    expect(alternatesOf('/guide/a', setup, has).map((a) => [a.locale.code, a.route])).toEqual([
      ['en', '/guide/a'],
      ['ja', '/ja/guide/a'],
    ]);
    expect(alternatesOf('/guide/b', setup, has).map((a) => a.locale.code)).toEqual(['en']);
  });

  it('builds a nav rooted at a locale section', () => {
    expect(buildNav(entriesForLocale(entries, 'ja', setup), { section: '/ja' })).toEqual([
      { text: 'Guide', link: '/ja/guide/a' },
    ]);
  });
});

describe('createSiteModel', () => {
  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    base: '/',
    generatedAt: '',
    entries,
    locales: setup.locales,
    defaultLocale: 'en',
  };
  const model = createSiteModel(manifest);

  it('reads locales from the manifest', () => {
    expect(model.setup?.defaultLocale).toBe('en');
    expect(model.localeOf('/ja/x')).toBe('ja');
  });

  it('resolves homes, sections and reading order per locale', () => {
    expect(model.home('en')).toBe('/');
    expect(model.home('ja')).toBe('/ja');
    expect(model.home('pt-br')).toBe('/pt-br'); // no pages → the bare prefix
    expect(model.section('/ja/guide/a', 'ja')).toBe('/ja/guide');
    expect(model.section('/ja', 'ja')).toBe('/ja');
    expect(model.section('/guide/a', 'en')).toBe('/guide');
    expect(model.ordered('ja').map((e) => e.path)).toEqual(['/ja', '/ja/guide/a']);
  });

  it('resolves locale roots without an index to their first page', () => {
    const noIndex = createSiteModel({
      ...manifest,
      entries: entries.filter((e) => e.path !== '/ja'),
    });
    expect(noIndex.resolve('/ja', 'ja')).toBe('/ja/guide/a');
    expect(noIndex.home('ja')).toBe('/ja/guide/a');
    expect(noIndex.resolve('/ja/nope', 'ja')).toBeNull();
    expect(noIndex.resolve('/guide/a/', 'en')).toBe('/guide/a');
  });

  it('emits hreflang alternates only for translated pages, with x-default', () => {
    expect(model.alternates('/guide/a')).toEqual([
      { hreflang: 'en', route: '/guide/a' },
      { hreflang: 'ja', route: '/ja/guide/a' },
      { hreflang: 'x-default', route: '/guide/a' },
    ]);
    expect(model.alternates('/guide/b')).toBeUndefined();
  });

  it('is a passthrough for unlocalised sites', () => {
    const plain = createSiteModel({ ...manifest, locales: undefined, defaultLocale: undefined });
    expect(plain.setup).toBeNull();
    expect(plain.localeOf('/ja/x')).toBeUndefined();
    expect(plain.entries(undefined)).toBe(entries);
    expect(plain.alternates('/guide/a')).toBeUndefined();
  });
});

describe('stripManifestBase / assertManifest', () => {
  it('turns base-prefixed routes into base-relative ones', () => {
    const m = stripManifestBase({
      version: MANIFEST_VERSION,
      base: '/docs/',
      generatedAt: '',
      entries: [makeEntry('index.md', {}, '/docs/'), makeEntry('guide/a.md', {}, '/docs/')],
    });
    expect(m.entries.map((e) => e.path)).toEqual(['/', '/guide/a']);
    const root: Manifest = { version: MANIFEST_VERSION, base: '/', generatedAt: '', entries };
    expect(stripManifestBase(root)).toBe(root);
  });

  it('validates locales', () => {
    const base = { version: MANIFEST_VERSION, base: '/', entries: [] };
    expect(() => assertManifest({ ...base, locales: [{ code: 'en' }] })).not.toThrow();
    expect(() => assertManifest({ ...base, locales: 'en' })).toThrow(/locales/);
    expect(() => assertManifest({ ...base, locales: [{}] })).toThrow(/code/);
  });
});

describe('generateManifest with locales', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'md-book-i18n-'));
    mkdirSync(join(dir, 'ja', 'guide'), { recursive: true });
    mkdirSync(join(dir, 'guide'), { recursive: true });
    writeFileSync(join(dir, 'index.md'), '# Home');
    writeFileSync(join(dir, 'guide', 'a.md'), '# A');
    writeFileSync(join(dir, 'ja', 'index.md'), '# ホーム');
    writeFileSync(join(dir, 'ja', 'guide', 'a.md'), '# えー');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('tags entries with their locale and stores the locale list', () => {
    const m = generateManifest({ contentDir: dir, locales: ['en', 'ja'] });
    expect(m.defaultLocale).toBe('en');
    expect(m.locales?.map((l) => l.code)).toEqual(['en', 'ja']);
    expect(Object.fromEntries(m.entries.map((e) => [e.path, e.locale]))).toEqual({
      '/': 'en',
      '/guide/a': 'en',
      '/ja': 'ja',
      '/ja/guide/a': 'ja',
    });
    expect(() => assertManifest(m)).not.toThrow();
  });

  it('detects the locale through a base prefix', () => {
    const m = generateManifest({ contentDir: dir, locales: ['en', 'ja'], base: '/docs/' });
    expect(m.entries.find((e) => e.path === '/docs/ja/guide/a')?.locale).toBe('ja');
    expect(m.entries.find((e) => e.path === '/docs/guide/a')?.locale).toBe('en');
  });

  it('leaves the manifest unlocalised without a locale list', () => {
    const m = generateManifest({ contentDir: dir });
    expect(m.locales).toBeUndefined();
    expect(m.entries.every((e) => e.locale === undefined)).toBe(true);
  });
});
