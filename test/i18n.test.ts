// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALE,
  MANIFEST_VERSION,
  type Manifest,
  SUPPORTED_LOCALES,
  type UIStrings,
  createStrings,
  getStrings,
  makeEntry,
  resolveLocale,
} from '../src/index.js';
import { mount } from '../src/runtime/index.js';

describe('resolveLocale', () => {
  it('returns the default when nothing is given', () => {
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('matches supported locales case-insensitively', () => {
    expect(resolveLocale('ja')).toBe('ja');
    expect(resolveLocale('JA')).toBe('ja');
    expect(resolveLocale('en')).toBe('en');
  });

  it('falls back to the primary subtag for BCP-47 tags', () => {
    expect(resolveLocale('ja-JP')).toBe('ja');
    expect(resolveLocale('en-US')).toBe('en');
  });

  it('falls back to the default for unknown locales', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('zh-Hans')).toBe('en');
  });
});

describe('string tables', () => {
  it('every supported locale exposes the same keys', () => {
    const reference = Object.keys(getStrings('en')).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(getStrings(locale)).sort()).toEqual(reference);
    }
  });

  it('ja differs from en and keeps entry types', () => {
    const en = getStrings('en');
    const ja = getStrings('ja');
    expect(ja.previous).not.toBe(en.previous);
    expect(typeof ja.blog).toBe('string');
    expect(ja.blogListPageTitle(2)).toContain('2');
    expect(ja.paginationStatus(1, 3)).toMatch(/1|3/);
    expect(typeof ja.pageNotFoundBody('/x')).toBe('string');
  });
});

describe('createStrings', () => {
  it('resolves the locale and returns its table', () => {
    const { locale, strings } = createStrings('ja-JP');
    expect(locale).toBe('ja');
    expect(strings.copy).toBe(getStrings('ja').copy);
  });

  it('shallow-merges overrides on top of the resolved table', () => {
    const overrides: Partial<UIStrings> = { copy: 'COPY!', blog: 'Journal' };
    const { strings } = createStrings('en', overrides);
    expect(strings.copy).toBe('COPY!');
    expect(strings.blog).toBe('Journal');
    expect(strings.next).toBe(getStrings('en').next);
  });
});

describe('mount with locale', () => {
  const FILES: Record<string, string> = {
    'index.md': '---\ntitle: Home\n---\n# Home\n',
    'guide/01-getting-started.md':
      '---\ntitle: Getting Started\n---\n# Getting Started\n\n## Install\n\nrun it\n',
    'blog/index.md': '---\ntitle: Blog\n---\n# The Blog\n',
    'blog/2026-02-01-hello.md': '---\ntitle: Hello\ndate: 2026-02-01\n---\nbody\n',
    'blog/2026-01-15-earlier.md': '---\ntitle: Earlier\ndate: 2026-01-15\n---\nbody\n',
  };

  const fetchText = vi.fn(async (url: string) => {
    const key = new URL(url).pathname.replace(/^\//, '');
    const body = FILES[key];
    if (body === undefined) throw new Error(`404 ${key}`);
    return body;
  });

  const manifest = (): Manifest => ({
    version: MANIFEST_VERSION,
    base: '/',
    generatedAt: '2026-01-01T00:00:00.000Z',
    entries: [
      makeEntry('index.md', { title: 'Home' }),
      makeEntry('guide/01-getting-started.md', { title: 'Getting Started' }),
      makeEntry('blog/index.md', { title: 'Blog' }),
      makeEntry('blog/2026-02-01-hello.md', { title: 'Hello', date: '2026-02-01' }),
      makeEntry('blog/2026-01-15-earlier.md', { title: 'Earlier', date: '2026-01-15' }),
    ],
  });

  beforeEach(() => {
    fetchText.mockClear();
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('lang');
  });

  it('sets <html lang> and translates the shell chrome', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, { manifest: manifest(), fetchText, locale: 'ja' });

    expect(document.documentElement.lang).toBe('ja');
    expect(host.querySelector('.md-book-skip')?.textContent).toBe('本文へスキップ');
    expect(host.querySelector('.md-book-toc')?.getAttribute('aria-label')).toBe('このページの内容');
    expect(host.querySelector('.md-book-theme-toggle')?.getAttribute('aria-label')).toMatch(
      /テーマ/,
    );
    handle.destroy();
  });

  it('translates the pager and code-copy button', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, { manifest: manifest(), fetchText, locale: 'ja' });

    handle.navigate('/guide/getting-started');
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector('.md-book-pager__dir')?.textContent).toBe('前へ');
    handle.destroy();
  });

  it('translates blog list chrome and localises post dates', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: manifest(),
      fetchText,
      blog: { perPage: 1 },
      locale: 'ja',
    });

    handle.navigate('/blog');
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector('.md-book-pagination__status')?.textContent).toContain('ページ');
    const time = host.querySelector('.md-book-post__meta time');
    expect(time?.getAttribute('datetime')).toBe('2026-02-01');
    expect(time?.textContent).toContain('2026');
    expect(time?.textContent).not.toBe('2026-02-01');
    handle.destroy();
  });

  it('defaults to English when no locale is given', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, { manifest: manifest(), fetchText });

    expect(document.documentElement.lang).toBe('en');
    expect(host.querySelector('.md-book-skip')?.textContent).toBe('Skip to content');
    handle.destroy();
  });
});
