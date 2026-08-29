// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST_VERSION, type Manifest, makeEntry } from '../src/index.js';
import { mount } from '../src/runtime/index.js';

const FILES: Record<string, string> = {
  'index.md': '---\ntitle: Home\n---\n# Home\n\nWelcome.',
  'guide/01-intro.md': '---\ntitle: Intro\n---\n# Intro\n\n## Section\n\ntext',
};

const manifest = (): Manifest => ({
  version: MANIFEST_VERSION,
  base: '/',
  title: 'Docs',
  generatedAt: '2026-01-01T00:00:00.000Z',
  entries: [
    makeEntry('index.md', { title: 'Home' }),
    makeEntry('guide/01-intro.md', { title: 'Intro' }),
  ],
});

const fetchText = vi.fn(async (url: string) => FILES[new URL(url).pathname.replace(/^\//, '')]!);

let root: HTMLElement;
beforeEach(async () => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
  const host = document.createElement('div');
  document.body.append(host);
  const handle = await mount(host, { manifest: manifest(), fetchText });
  handle.navigate('/guide/intro');
  await new Promise((r) => setTimeout(r, 0));
  root = host;
});

describe('accessibility structure', () => {
  it('exposes labelled landmarks', () => {
    expect(root.querySelector('header')).toBeTruthy();
    expect(root.querySelector('main')).toBeTruthy();
    expect(root.querySelector('aside')).toBeTruthy();
    for (const nav of root.querySelectorAll('nav')) {
      expect(nav.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    }
  });

  it('puts a skip link first that targets main', () => {
    const shell = root.querySelector('.md-book')!;
    expect(shell.firstElementChild?.classList.contains('md-book-skip')).toBe(true);
    expect(shell.firstElementChild?.getAttribute('href')).toBe('#md-book-content');
    expect(root.querySelector('main')?.id).toBe('md-book-content');
  });

  it('renders exactly one h1 in the article', () => {
    expect(root.querySelectorAll('.md-book-article h1')).toHaveLength(1);
  });

  it('marks the current page and gives main a focus target', () => {
    expect(root.querySelector('.md-book-sidebar__link[aria-current="page"]')?.textContent).toBe(
      'Intro',
    );
    expect(root.querySelector('main')?.getAttribute('tabindex')).toBe('-1');
  });

  it('gives the theme toggle an accessible name', () => {
    const toggle = root.querySelector('.md-book-theme-toggle');
    expect(toggle?.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    expect(toggle?.hasAttribute('aria-pressed')).toBe(true);
  });
});
