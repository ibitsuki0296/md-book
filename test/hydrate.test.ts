// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSite } from '../src/core/site.js';
import { MANIFEST_VERSION, type Manifest, makeEntry } from '../src/index.js';
import { mount } from '../src/runtime/index.js';

const FILES: Record<string, string> = {
  'index.md': '---\ntitle: Home\n---\n# Home\n\nWelcome.\n',
  'guide/01-start.md':
    '---\ntitle: Start\n---\n# Start\n\n## Install\n\n```js\nconst x = 1;\n```\n',
  'guide/02-next.md': '---\ntitle: Next\n---\n# Next\n\nSecond page.\n',
};

const manifest: Manifest = {
  version: MANIFEST_VERSION,
  base: '/',
  contentBase: '/',
  generatedAt: '2026-01-01T00:00:00.000Z',
  entries: [
    makeEntry('index.md', { title: 'Home' }),
    makeEntry('guide/01-start.md', { title: 'Start' }),
    makeEntry('guide/02-next.md', { title: 'Next' }),
  ],
};

const fetchText = vi.fn(async (url: string) => {
  const key = new URL(url).pathname.replace(/^\//, '');
  const body = FILES[key];
  if (body === undefined) throw new Error(`404 ${key}`);
  return body;
});

/** The `<md-book>` element exactly as `md-book build` writes it for `route`. */
function prerender(route: string): string {
  const pages = renderSite({ manifest, readSource: (e) => FILES[e.file] ?? '' });
  const html = pages.find((p) => p.route === route)?.html ?? '';
  const match = html.match(/<md-book [^>]*>([\s\S]*)<\/md-book>/);
  if (!match) throw new Error(`no <md-book> for ${route}`);
  return match[1] as string;
}

function setup(route: string, url = route): HTMLElement {
  window.history.replaceState({}, '', url);
  document.body.innerHTML = '<div id="app"></div>';
  const host = document.getElementById('app') as HTMLElement;
  host.innerHTML = prerender(route);
  return host;
}

beforeEach(() => {
  fetchText.mockClear();
});

describe('adopting pre-rendered markup', () => {
  it('stamps the route on the SSG document, but not on the 404 page', () => {
    const pages = renderSite({ manifest, readSource: (e) => FILES[e.file] ?? '' });
    expect(pages.find((p) => p.route === '/guide/start')?.html).toContain(
      'data-prerendered="/guide/start"',
    );
    expect(pages.find((p) => p.route === '/404')?.html).not.toContain('data-prerendered');
  });

  it('keeps the existing DOM and skips re-fetching the page', async () => {
    const host = setup('/guide/start');
    const article = host.querySelector('article');
    const root = host.querySelector('.md-book');

    const handle = await mount(host, { manifest, fetchText, prerendered: '/guide/start' });

    expect(handle.element).toBe(root);
    expect(host.querySelector('article')).toBe(article);
    expect(article?.querySelector('h1')?.textContent).toContain('Start');
    expect(fetchText).not.toHaveBeenCalled();
    // The runtime still attaches its own chrome and behaviour.
    expect(host.querySelector('.md-book-theme-toggle')).not.toBeNull();
    expect(host.querySelector('.md-book-code__copy')).not.toBeNull();
    expect(host.querySelectorAll('.md-book-brand')).toHaveLength(1);
    handle.destroy();
  });

  it('navigates normally after taking over', async () => {
    const host = setup('/guide/start');
    const handle = await mount(host, { manifest, fetchText, prerendered: '/guide/start' });

    handle.navigate('/guide/next');
    await vi.waitFor(() => expect(host.querySelector('article h1')?.textContent).toContain('Next'));
    expect(fetchText).toHaveBeenCalledTimes(1);
    handle.destroy();
  });

  it('rebuilds when the URL is not the route the markup was rendered for', async () => {
    // e.g. a host that serves the home page's HTML for every path
    const host = setup('/', '/guide/next');
    const article = host.querySelector('article');

    const handle = await mount(host, { manifest, fetchText, prerendered: '/' });

    expect(host.querySelector('article')?.textContent).toContain('Second page.');
    expect(host.querySelector('article')).toBe(article); // same shell, new content
    expect(fetchText).toHaveBeenCalledTimes(1);
    handle.destroy();
  });

  it('builds from scratch when there is nothing to adopt', async () => {
    window.history.replaceState({}, '', '/guide/start');
    document.body.innerHTML = '<div id="app"></div>';
    const host = document.getElementById('app') as HTMLElement;

    const handle = await mount(host, { manifest, fetchText, prerendered: '/guide/start' });

    expect(host.querySelector('article h1')?.textContent).toContain('Start');
    expect(fetchText).toHaveBeenCalledTimes(1);
    handle.destroy();
  });
});

describe('page footer slot', () => {
  it('stays hidden until the first page is rendered', async () => {
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = '<div id="app"></div>';
    const host = document.getElementById('app') as HTMLElement;
    let release: (() => void) | undefined;
    const slow = vi.fn(async (url: string) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return fetchText(url);
    });

    const pending = mount(host, { manifest, fetchText: slow, slots: { pageFooter: 'Footer' } });
    await vi.waitFor(() => expect(host.querySelector('.md-book-page-footer')).not.toBeNull());
    expect((host.querySelector('.md-book-page-footer') as HTMLElement).hidden).toBe(true);

    release?.();
    const handle = await pending;
    expect((host.querySelector('.md-book-page-footer') as HTMLElement).hidden).toBe(false);
    expect(host.querySelector('.md-book-page-footer')?.textContent).toBe('Footer');
    handle.destroy();
  });
});
