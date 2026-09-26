// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MANIFEST_VERSION,
  type Manifest,
  type SearchIndex,
  createSearchIndex,
  extractSearchDoc,
  makeEntry,
} from '../src/index.js';
import { mount, typesetDiagrams, typesetMath } from '../src/runtime/index.js';

const FILES: Record<string, string> = {
  'index.md': '---\ntitle: Home\n---\n# Home\n\nEnglish home\n',
  'guide/01-a.md':
    '---\ntitle: Alpha\n---\n# Alpha\n\n## Install\n\nInline $x^2$ math.\n\n```mermaid\ngraph TD; A-->B\n```\n',
  'guide/02-b.md': '---\ntitle: Beta\n---\n# Beta\n\nOnly in English\n',
  'ja/index.md': '---\ntitle: ホーム\n---\n# ホーム\n\n日本語のホーム\n',
  'ja/guide/01-a.md': '---\ntitle: アルファ\n---\n# アルファ\n\n## 導入\n\n本文\n',
  'blog/2026-01-01-one.md': '---\ntitle: One\ndate: 2026-01-01\n---\nfirst\n',
  'ja/blog/2026-01-02-ichi.md': '---\ntitle: 一\ndate: 2026-01-02\n---\n最初\n',
};

const manifest = (): Manifest => ({
  version: MANIFEST_VERSION,
  base: '/',
  generatedAt: '',
  locales: [
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語', title: 'ドキュメント' },
  ],
  defaultLocale: 'en',
  entries: Object.keys(FILES).map((file) => {
    const fm = /title: (.*)/.exec(FILES[file]!)?.[1] ?? '';
    const date = /date: (.*)/.exec(FILES[file]!)?.[1];
    return makeEntry(file, { title: fm, ...(date ? { date } : {}) });
  }),
});

const fetchText = vi.fn(async (url: string) => {
  const key = new URL(url).pathname.replace(/^\//, '');
  const body = FILES[key];
  if (body === undefined) throw new Error(`404 ${key}`);
  return body;
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const linkTexts = (host: Element, sel: string) =>
  [...host.querySelectorAll(sel)].map((a) => a.textContent);

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.documentElement.lang = '';
  fetchText.mockClear();
});

async function mountSite(extra: Parameters<typeof mount>[1] = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = await mount(host, { manifest: manifest(), fetchText, ...extra });
  return { host, handle };
}

describe('content-level i18n', () => {
  it('starts in the default locale with a language switcher', async () => {
    const { host, handle } = await mountSite();
    expect(document.documentElement.lang).toBe('en');
    const select = host.querySelector<HTMLSelectElement>('.md-book-lang__select')!;
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['en', 'English'],
      ['ja', '日本語'],
    ]);
    expect(select.value).toBe('en');
    expect(select.getAttribute('aria-label')).toBe('Language');
    // nav + sidebar contain English pages only
    expect(linkTexts(host, '.md-book-nav__link')).toEqual(['Blog', 'Guide']);
    expect(host.textContent).not.toContain('アルファ');
    handle.destroy();
  });

  it('follows the route locale: UI strings, <html lang>, nav, sidebar, brand, head', async () => {
    const { host, handle } = await mountSite({ title: 'Docs' });
    handle.navigate('/ja/guide/a');
    await tick();
    await tick();

    expect(document.documentElement.lang).toBe('ja');
    expect(host.querySelector('.md-book-article h1')?.textContent).toContain('アルファ');
    expect(linkTexts(host, '.md-book-nav__link')).toEqual(['Blog', 'Guide']); // ja section: blog + guide
    expect(linkTexts(host, '.md-book-sidebar__link')).toEqual(['アルファ']);
    expect(host.querySelector('.md-book-toc__title')?.textContent).toBe('このページの内容');
    expect(host.querySelector('.md-book-skip')?.textContent).toBe('本文へスキップ');
    expect(host.querySelector('.md-book-lang__select')?.getAttribute('aria-label')).toBe('言語');
    expect((host.querySelector('.md-book-lang__select') as HTMLSelectElement).value).toBe('ja');
    expect(host.querySelector('.md-book-brand')?.textContent).toBe('ドキュメント'); // per-locale title
    expect(host.querySelector('.md-book-brand')?.getAttribute('href')).toBe('/ja');
    expect(document.title).toBe('アルファ — ドキュメント');
    expect(document.head.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe(
      'ja',
    );

    // hreflang alternates for a translated page
    const alternates = [...document.head.querySelectorAll('link[rel="alternate"]')].map((l) => [
      l.getAttribute('hreflang'),
      l.getAttribute('href'),
    ]);
    expect(alternates).toEqual([
      ['en', 'http://localhost:3000/guide/a'],
      ['ja', 'http://localhost:3000/ja/guide/a'],
      ['x-default', 'http://localhost:3000/guide/a'],
    ]);

    // …and back
    handle.navigate('/guide/a');
    await tick();
    await tick();
    expect(document.documentElement.lang).toBe('en');
    expect(host.querySelector('.md-book-toc__title')?.textContent).toBe('On this page');
    expect(document.head.querySelectorAll('link[rel="alternate"]').length).toBe(3);
    handle.destroy();
  });

  it('shows the locale root when a locale has no page at "/"', async () => {
    const m = manifest();
    m.entries = m.entries.filter((e) => e.path !== '/ja');
    const { host, handle } = await mountSite({ manifest: m });
    handle.navigate('/ja');
    await tick();
    await tick();
    expect(host.querySelector('.md-book-article')?.textContent).toContain('最初'); // the locale's first page
    handle.destroy();
  });

  it('language switcher jumps to the translation, or the locale home when missing', async () => {
    const { host, handle } = await mountSite();
    handle.navigate('/guide/a');
    await tick();
    await tick();
    const select = host.querySelector<HTMLSelectElement>('.md-book-lang__select')!;

    select.value = 'ja';
    select.dispatchEvent(new Event('change'));
    await tick();
    await tick();
    expect(window.location.pathname).toBe('/ja/guide/a');

    handle.navigate('/guide/b'); // only exists in English
    await tick();
    await tick();
    select.value = 'ja';
    select.dispatchEvent(new Event('change'));
    await tick();
    await tick();
    expect(window.location.pathname).toBe('/ja');
    handle.destroy();
  });

  it('serves per-locale blog routes', async () => {
    const { host, handle } = await mountSite({ blog: true });
    handle.navigate('/blog');
    await tick();
    await tick();
    expect(linkTexts(host, '.md-book-post__title a')).toEqual(['One']);

    handle.navigate('/ja/blog');
    await tick();
    await tick();
    expect(linkTexts(host, '.md-book-post__title a')).toEqual(['一']);
    expect(host.querySelector('.md-book-post__title a')?.getAttribute('href')).toBe(
      '/ja/blog/ichi',
    );
    handle.destroy();
  });

  it('does nothing locale-related for an unlocalised manifest', async () => {
    const m = manifest();
    m.locales = undefined;
    m.defaultLocale = undefined;
    const { host, handle } = await mountSite({ manifest: m, locale: 'ja' });
    expect(host.querySelector('.md-book-lang')).toBeNull();
    expect(document.documentElement.lang).toBe('ja');
    handle.destroy();
  });

  it('lets mount({ locales }) override the manifest', async () => {
    const { host, handle } = await mountSite({ locales: ['en', { code: 'ja', label: 'JP' }] });
    expect(linkTexts(host, '.md-book-lang__select option')).toEqual(['English', 'JP']);
    handle.destroy();
  });
});

describe('base-prefixed manifests', () => {
  it('routes work when the manifest was generated with --base', async () => {
    window.history.replaceState({}, '', '/docs/guide/a');
    const m: Manifest = {
      version: MANIFEST_VERSION,
      base: '/docs/',
      generatedAt: '',
      contentBase: '/',
      entries: [
        makeEntry('index.md', { title: 'Home' }, '/docs/'),
        makeEntry('guide/01-a.md', { title: 'Alpha' }, '/docs/'),
      ],
    };
    const { host, handle } = await mountSite({ manifest: m, locales: undefined });
    expect(host.querySelector('.md-book-article h1')?.textContent).toContain('Alpha');
    expect(host.querySelector('.md-book-sidebar__link')?.getAttribute('href')).toBe(
      '/docs/guide/a',
    );
    handle.destroy();
  });
});

describe('search', () => {
  const index = (): SearchIndex =>
    createSearchIndex(
      Object.entries(FILES).map(([file, body]) =>
        extractSearchDoc(body, {
          path: manifest().entries.find((e) => e.file === file)!.path,
          title: /title: (.*)/.exec(body)![1]!,
          locale: file.startsWith('ja/') ? 'ja' : 'en',
        }),
      ),
    );
  const fetchJson = vi.fn(async (url: string) => {
    if (!url.endsWith('/search-index.json')) throw new Error(`unexpected ${url}`);
    return index();
  });

  async function mountWithSearch(extra: Parameters<typeof mount>[1] = {}) {
    fetchJson.mockClear();
    const site = await mountSite({ search: true, fetchJson, ...extra });
    const input = site.host.querySelector<HTMLInputElement>('.md-book-search__input')!;
    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await tick();
      await tick();
    };
    return { ...site, input, type };
  }

  it('is absent unless enabled', async () => {
    const { host, handle } = await mountSite();
    expect(host.querySelector('.md-book-search')).toBeNull();
    handle.destroy();
  });

  it('lazy-loads the index on first input and lists ranked, highlighted results', async () => {
    const { host, handle, input, type } = await mountWithSearch();
    expect(fetchJson).not.toHaveBeenCalled();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-label')).toBe('Search');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    await type('install');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson.mock.calls[0]![0]).toMatch(/\/search-index\.json$/);
    const items = [...host.querySelectorAll('.md-book-search__item')];
    expect(items).toHaveLength(1);
    expect(items[0]?.querySelector('.md-book-search__title')?.textContent).toBe('Alpha');
    expect(items[0]?.querySelector('mark')?.textContent.toLowerCase()).toBe('install');
    expect(items[0]?.querySelector('a')?.getAttribute('href')).toBe('/guide/a');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('.md-book-search__status')?.textContent).toBe('1 result');
    expect(input.getAttribute('aria-activedescendant')).toBe(items[0]?.id);

    await type('nothingmatches');
    expect(host.querySelector('.md-book-search__status')?.textContent).toBe(
      'No results for “nothingmatches”.',
    );
    expect(host.querySelectorAll('.md-book-search__item')).toHaveLength(0);

    await type('');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(fetchJson).toHaveBeenCalledTimes(1); // index is cached
    handle.destroy();
  });

  it('never injects markup from page text into the results', async () => {
    const evil = createSearchIndex([
      {
        path: '/x',
        title: '<img src=x onerror=alert(1)>',
        headings: [],
        text: 'payload <script>alert(1)</script> here',
      },
    ]);
    const { host, handle, type } = await mountWithSearch({ fetchJson: async () => evil });
    await type('payload');
    expect(
      host.querySelector('.md-book-search__list img, .md-book-search__list script'),
    ).toBeNull();
    expect(host.querySelector('.md-book-search__title')?.textContent).toContain('<img');
    handle.destroy();
  });

  it('restricts results to the current locale', async () => {
    const { host, handle, type } = await mountWithSearch();
    await type('本文');
    expect(host.querySelectorAll('.md-book-search__item')).toHaveLength(0); // ja page, but we're in English
    handle.navigate('/ja/guide/a');
    await tick();
    await tick();
    await type('本文');
    expect(host.querySelectorAll('.md-book-search__item')).toHaveLength(1);
    await type('home');
    expect(host.querySelectorAll('.md-book-search__item')).toHaveLength(0); // English home is filtered out
    await type('ホーム');
    expect(host.querySelectorAll('.md-book-search__item')).toHaveLength(1);
    expect(host.querySelector('.md-book-search__input')?.getAttribute('aria-label')).toBe('検索');
    handle.destroy();
  });

  it('supports keyboard navigation: arrows, Enter, Escape, and "/" to focus', async () => {
    const { host, handle, input, type } = await mountWithSearch();
    await type('a'); // matches several pages
    const items = () => [...host.querySelectorAll('.md-book-search__item')];
    expect(items().length).toBeGreaterThan(1);
    expect(items()[0]?.getAttribute('aria-selected')).toBe('true');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(items()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(items()[0]?.getAttribute('aria-selected')).toBe('false');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(items().at(-1)?.getAttribute('aria-selected')).toBe('true'); // wraps

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    await type('beta');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await tick();
    await tick();
    expect(window.location.pathname).toBe('/guide/b');
    expect(input.value).toBe('');

    input.blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(input);
    handle.destroy();
    expect(document.querySelector('.md-book-search')).toBeNull();
  });

  it('reports a failed index load, and retries next time', async () => {
    let calls = 0;
    const { host, handle, type } = await mountWithSearch({
      fetchJson: async () => {
        calls++;
        if (calls === 1) throw new Error('offline');
        return index();
      },
    });
    await type('beta');
    expect(host.querySelector('.md-book-search__status')?.textContent).toBe(
      'Search is unavailable.',
    );
    await type('beta ');
    expect(host.querySelectorAll('.md-book-search__item')).toHaveLength(1);
    handle.destroy();
  });

  it('finds the index next to a relative manifest URL (as set by <md-book manifest="/manifest.json">)', async () => {
    const urls: string[] = [];
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifestUrl: '/docs-site/manifest.json',
      search: true,
      fetchText,
      fetchJson: async (url) => {
        urls.push(url);
        return url.endsWith('manifest.json') ? manifest() : index();
      },
    });
    const input = host.querySelector<HTMLInputElement>('.md-book-search__input')!;
    input.value = 'beta';
    input.dispatchEvent(new Event('input'));
    await tick();
    await tick();
    expect(urls).toEqual([
      '/docs-site/manifest.json',
      'http://localhost:3000/docs-site/search-index.json',
    ]);
    handle.destroy();
  });

  it('honours a custom index url', async () => {
    const { handle, type } = await mountWithSearch({
      search: { url: '/custom/idx.json', limit: 1 },
    });
    fetchJson.mockImplementation(async () => index());
    await type('a');
    expect(fetchJson.mock.calls[0]![0]).toBe('http://localhost:3000/custom/idx.json');
    handle.destroy();
  });
});

describe('math and diagrams', () => {
  it('typesetMath renders each .md-book-math once with KaTeX options', async () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<span class="md-book-math">x^2</span><div class="md-book-math md-book-math--display">y</div>';
    const render = vi.fn((tex: string, el: HTMLElement, _options?: Record<string, unknown>) => {
      el.innerHTML = `<i>${tex}</i>`;
    });
    await typesetMath(root, { load: async () => ({ render }), katex: { macros: { '\\R': 'R' } } });
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[0]?.[2]).toMatchObject({
      displayMode: false,
      throwOnError: false,
      macros: { '\\R': 'R' },
    });
    expect(render.mock.calls[1]?.[2]).toMatchObject({ displayMode: true });
    expect(root.querySelectorAll('.md-book-math--rendered')).toHaveLength(2);
    await typesetMath(root, { load: async () => ({ render }) });
    expect(render).toHaveBeenCalledTimes(2); // already rendered → untouched
  });

  it('accepts `import()` namespaces with the API on .default', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<span class="md-book-math">z</span><pre class="md-book-mermaid">g</pre>';
    const render = vi.fn((_tex: string, el: HTMLElement) => {
      el.textContent = 'ok';
    });
    await typesetMath(root, { load: async () => ({ default: { render } }) });
    expect(render).toHaveBeenCalledTimes(1);
    const draw = vi.fn(async () => ({ svg: '<svg></svg>' }));
    await typesetDiagrams(root, 'light', {
      load: async () => ({ default: { initialize: () => undefined, render: draw } }),
    });
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('typesetMath leaves the source visible when KaTeX throws or fails to load', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<span class="md-book-math">bad</span>';
    await typesetMath(root, {
      load: async () => ({
        render: () => {
          throw new Error('parse');
        },
      }),
    });
    expect(root.textContent).toBe('bad');
    expect(root.querySelector('.md-book-math--rendered')).toBeNull();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await typesetMath(root, {
      load: async () => {
        throw new Error('offline');
      },
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(root.textContent).toBe('bad');
  });

  it('typesetDiagrams draws with the theme, keeps the source, and can redraw', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<pre class="md-book-mermaid">graph TD; A--&gt;B</pre>';
    const initialize = vi.fn();
    const render = vi.fn(async (_id: string, src: string) => ({
      svg: `<svg data-src="${src}"></svg>`,
    }));
    const load = async () => ({ initialize, render });

    await typesetDiagrams(root, 'dark', { load, config: { flowchart: { htmlLabels: false } } });
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        startOnLoad: false,
        securityLevel: 'strict',
        flowchart: { htmlLabels: false },
      }),
    );
    const el = root.querySelector<HTMLElement>('.md-book-mermaid')!;
    expect(el.querySelector('svg')?.getAttribute('data-src')).toBe('graph TD; A-->B');
    expect(el.dataset.source).toBe('graph TD; A-->B');

    await typesetDiagrams(root, 'light', { load });
    expect(initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'default' }));
    expect(render).toHaveBeenLastCalledWith(expect.any(String), 'graph TD; A-->B'); // redrawn from data-source
  });

  it('typesetDiagrams falls back to the source on a syntax error', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<pre class="md-book-mermaid">nonsense</pre>';
    await typesetDiagrams(root, 'light', {
      load: async () => ({
        initialize: () => undefined,
        render: async () => {
          throw new Error('Parse error');
        },
      }),
    });
    const el = root.querySelector('.md-book-mermaid')!;
    expect(el.textContent).toBe('nonsense');
    expect(el.classList.contains('md-book-mermaid--error')).toBe(true);
  });

  it('mount() typesets math and diagrams after render when enabled', async () => {
    const render = vi.fn((tex: string, el: HTMLElement) => {
      el.innerHTML = `<i>${tex}</i>`;
    });
    const mermaidRender = vi.fn(async () => ({ svg: '<svg id="d"></svg>' }));
    const { host, handle } = await mountSite({
      math: { load: async () => ({ render }) },
      mermaid: { load: async () => ({ initialize: () => undefined, render: mermaidRender }) },
    });
    handle.navigate('/guide/a');
    await tick();
    await tick();
    await tick();
    expect(host.querySelector('.md-book-math--rendered i')?.textContent).toBe('x^2');
    expect(host.querySelector('.md-book-mermaid svg')).toBeTruthy();
    handle.destroy();
  });

  it('math/mermaid are inert unless enabled', async () => {
    const { host, handle } = await mountSite();
    handle.navigate('/guide/a');
    await tick();
    await tick();
    expect(host.querySelector('.md-book-math')).toBeNull(); // `$x^2$` stays plain text
    expect(host.querySelector('.md-book-mermaid')).toBeNull();
    expect(host.querySelector('code.language-mermaid')).toBeTruthy();
    handle.destroy();
  });
});
