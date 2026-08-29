// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST_VERSION, type Manifest, makeEntry } from '../src/index.js';
import {
  PageLoader,
  PageNotFoundError,
  addCodeCopyButtons,
  createRouter,
  createScrollSpy,
  defineElement,
  mount,
} from '../src/runtime/index.js';

const FILES: Record<string, string> = {
  'index.md': '---\ntitle: Home\n---\n# Home\n\nGo to the [guide](./guide/getting-started.md).\n',
  'guide/01-getting-started.md':
    '---\ntitle: Getting Started\n---\n# Getting Started\n\n## Install\n\nrun it\n\n## Usage\n\n```js\nconst x = 1;\n```\n',
  'blog/2026-02-01-hello.md': '---\ntitle: Hello\ndate: 2026-02-01\n---\n# Hello\n\npost body\n',
};

function makeManifest(): Manifest {
  return {
    version: MANIFEST_VERSION,
    base: '/',
    generatedAt: '2026-01-01T00:00:00.000Z',
    entries: [
      makeEntry('index.md', { title: 'Home' }),
      makeEntry('guide/01-getting-started.md', { title: 'Getting Started' }),
      makeEntry('blog/2026-02-01-hello.md', { title: 'Hello', date: '2026-02-01' }),
    ],
  };
}

const fetchText = vi.fn(async (url: string) => {
  const key = new URL(url).pathname.replace(/^\//, '');
  const body = FILES[key];
  if (body === undefined) throw new Error(`404 ${key}`);
  return body;
});

beforeEach(() => {
  fetchText.mockClear();
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

describe('createRouter', () => {
  it('emits the current path on start and strips the base path', () => {
    window.history.replaceState({}, '', '/docs/guide/intro');
    const onNavigate = vi.fn();
    const router = createRouter({ base: '/docs/', onNavigate });
    router.start();
    expect(onNavigate).toHaveBeenCalledWith(
      '/guide/intro',
      expect.objectContaining({ replace: true }),
    );
    router.stop();
  });

  it('navigate pushes history and re-emits', () => {
    const seen: string[] = [];
    const router = createRouter({ base: '/', onNavigate: (p) => seen.push(p) });
    router.start();
    router.navigate('/guide/getting-started#usage');
    expect(seen).toEqual(['/', '/guide/getting-started']);
    expect(window.location.pathname).toBe('/guide/getting-started');
    router.stop();
  });

  it('builds hrefs for history and hash modes', () => {
    const history = createRouter({ base: '/docs/', onNavigate: () => {} });
    expect(history.href('/guide/x')).toBe('/docs/guide/x');
    const hash = createRouter({ base: '/', mode: 'hash', onNavigate: () => {} });
    expect(hash.href('/guide/x#y')).toBe('#/guide/x#y');
  });
});

describe('PageLoader', () => {
  it('fetches, renders and caches pages by route path', async () => {
    const loader = new PageLoader({ manifest: makeManifest(), fetchText });
    const page = await loader.load('/guide/getting-started');
    expect(page.frontMatter.title).toBe('Getting Started');
    expect(page.html).toContain('<h2 id="install"');
    expect(page.headings.map((h) => h.id)).toEqual(['getting-started', 'install', 'usage']);

    await loader.load('/guide/getting-started');
    expect(fetchText).toHaveBeenCalledTimes(1);
  });

  it('rewrites relative links using the route path', async () => {
    const loader = new PageLoader({ manifest: makeManifest(), fetchText });
    const home = await loader.load('/');
    expect(home.html).toContain('href="/guide/getting-started"');
  });

  it('throws PageNotFoundError for an unknown route', async () => {
    const loader = new PageLoader({ manifest: makeManifest(), fetchText });
    await expect(loader.load('/nope')).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it('resolves file URLs against contentBase when set', () => {
    const manifest = { ...makeManifest(), contentBase: 'https://cdn.example/raw' };
    const loader = new PageLoader({ manifest, fetchText });
    const entry = loader.entry('/guide/getting-started')!;
    expect(loader.fileUrl(entry)).toBe('https://cdn.example/raw/guide/01-getting-started.md');
  });
});

describe('addCodeCopyButtons', () => {
  it('wraps code blocks and copies their text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const root = document.createElement('div');
    root.innerHTML = '<pre><code class="language-js">const x = 1;</code></pre>';
    addCodeCopyButtons(root);

    const wrapper = root.querySelector('.md-book-code') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.dataset.lang).toBe('js');
    const button = wrapper.querySelector('button') as HTMLButtonElement;
    button.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('const x = 1;');
  });

  it('is idempotent', () => {
    const root = document.createElement('div');
    root.innerHTML = '<pre><code>x</code></pre>';
    addCodeCopyButtons(root);
    addCodeCopyButtons(root);
    expect(root.querySelectorAll('.md-book-code')).toHaveLength(1);
  });
});

describe('createScrollSpy', () => {
  it('degrades to reporting the first heading when IntersectionObserver is missing', () => {
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error force the fallback path
    globalThis.IntersectionObserver = undefined;
    const onActive = vi.fn();
    const spy = createScrollSpy({
      content: document.createElement('div'),
      ids: ['a', 'b'],
      onActive,
    });
    expect(onActive).toHaveBeenCalledWith('a');
    spy.disconnect();
    globalThis.IntersectionObserver = original;
  });
});

describe('mount', () => {
  it('renders the shell, nav, first page, sidebar and TOC', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, { manifest: makeManifest(), fetchText });

    expect(host.querySelector('.md-book-header')).toBeTruthy();
    expect([...host.querySelectorAll('.md-book-nav__link')].map((a) => a.textContent)).toEqual([
      'Blog',
      'Guide',
    ]);
    // Root route has an index.md entry -> renders Home.
    expect(host.querySelector('.md-book-article h1')?.textContent).toContain('Home');
    expect(host.querySelectorAll('.md-book-sidebar__link').length).toBeGreaterThan(0);
    handle.destroy();
  });

  it('navigates between pages and updates document.title, TOC and pager', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: makeManifest(),
      title: 'My Docs',
      fetchText,
    });

    handle.navigate('/guide/getting-started');
    await new Promise((r) => setTimeout(r, 0));

    expect(host.querySelector('.md-book-article h1')?.textContent).toContain('Getting Started');
    expect(document.title).toBe('Getting Started — My Docs');
    expect([...host.querySelectorAll('.md-book-toc__link')].map((a) => a.textContent)).toEqual([
      'Install',
      'Usage',
    ]);
    expect(host.querySelector('.md-book-code')).toBeTruthy();
    handle.destroy();
  });

  it('adds a working theme toggle to the header', async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, { manifest: makeManifest(), fetchText });

    const toggle = host.querySelector<HTMLButtonElement>('.md-book-theme-toggle');
    expect(toggle).toBeTruthy();
    toggle!.click();
    expect(['light', 'dark']).toContain(document.documentElement.getAttribute('data-theme'));
    expect(handle.theme.get()).toBe(document.documentElement.getAttribute('data-theme'));
    handle.destroy();
  });

  it('omits the toggle when theme.toggle is false', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: makeManifest(),
      fetchText,
      theme: { toggle: false },
    });
    expect(host.querySelector('.md-book-theme-toggle')).toBeNull();
    handle.destroy();
  });

  it('shows a not-found message for an unregistered route', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, { manifest: makeManifest(), fetchText });

    handle.navigate('/does/not/exist');
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector('.md-book-article')?.textContent).toContain('Page not found');
    handle.destroy();
  });
});

describe('mount with blog', () => {
  function blogManifest(): Manifest {
    const dated = ['2026-05-01', '2026-04-01', '2026-03-01', '2026-02-01', '2026-01-01'];
    return {
      version: MANIFEST_VERSION,
      base: '/',
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: [
        makeEntry('index.md', { title: 'Home' }),
        makeEntry('blog/index.md', { title: 'Blog', description: 'updates' }),
        ...dated.map((d, i) =>
          makeEntry(`blog/${d}-post-${i}.md`, {
            title: `Post ${i}`,
            date: d,
            description: `summary ${i}`,
            tags: i % 2 === 0 ? ['news'] : ['notes'],
          }),
        ),
      ],
    };
  }

  const blogFetch = vi.fn(async (url: string) => {
    if (url.endsWith('/blog/index.md')) return '---\ntitle: Blog\n---\n# The Blog\n\nintro copy\n';
    return '---\ntitle: x\ndate: 2026-01-01\n---\nbody\n';
  });

  it('renders a paginated post list at /blog and /blog/page/2', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: blogManifest(),
      fetchText: blogFetch,
      blog: { perPage: 2 },
    });

    // /blog resolves first to the first ordered page (index.md), which is also the blog root.
    handle.navigate('/blog');
    await new Promise((r) => setTimeout(r, 0));
    let titles = [...host.querySelectorAll('.md-book-post__title')].map((n) => n.textContent);
    expect(titles).toEqual(['Post 0', 'Post 1']); // newest first, 2 per page
    expect(host.querySelector('.md-book-article')?.textContent).toContain('The Blog'); // index.md lead
    expect(host.querySelector('.md-book-pagination__status')?.textContent).toBe('Page 1 of 3');

    handle.navigate('/blog/page/2');
    await new Promise((r) => setTimeout(r, 0));
    titles = [...host.querySelectorAll('.md-book-post__title')].map((n) => n.textContent);
    expect(titles).toEqual(['Post 2', 'Post 3']);
    expect(document.title).toContain('page 2');
    handle.destroy();
  });

  it('renders a tag page at /tags/:slug', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: blogManifest(),
      fetchText: blogFetch,
      blog: true,
    });

    handle.navigate('/tags/news');
    await new Promise((r) => setTimeout(r, 0));
    const titles = [...host.querySelectorAll('.md-book-post__title')].map((n) => n.textContent);
    expect(titles).toEqual(['Post 0', 'Post 2', 'Post 4']);
    expect(host.querySelector('.md-book-blog__lead')?.textContent).toContain('news');
    handle.destroy();
  });

  it('leaves non-blog routes to normal page loading', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: blogManifest(),
      fetchText: blogFetch,
      blog: true,
    });
    handle.navigate('/nope');
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelector('.md-book-article')?.textContent).toContain('Page not found');
    handle.destroy();
  });
});

describe('mount SEO head', () => {
  const seoFetch = vi.fn(async (url: string) => {
    if (url.endsWith('/blog/2026-02-01-hello.md'))
      return '---\ntitle: Hello\ndate: 2026-02-01\nauthor: Ada\ntags: [news]\n---\npost body';
    return FILES['guide/01-getting-started.md']!;
  });

  const seoManifest = (): Manifest => ({
    version: MANIFEST_VERSION,
    base: '/',
    title: 'Docs',
    generatedAt: '2026-01-01T00:00:00.000Z',
    entries: [
      makeEntry('guide/01-getting-started.md', { title: 'Getting Started' }),
      makeEntry('blog/2026-02-01-hello.md', { title: 'Hello', date: '2026-02-01' }),
    ],
  });

  beforeEach(() => {
    for (const el of document.head.querySelectorAll('[data-md-book-head]')) el.remove();
  });

  it('writes canonical, Open Graph and Twitter meta for a page', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: seoManifest(),
      fetchText: seoFetch,
      seo: { siteUrl: 'https://example.com/', siteName: 'Docs', twitterSite: '@docs' },
    });
    handle.navigate('/guide/getting-started');
    await new Promise((r) => setTimeout(r, 0));

    const meta = (sel: string) =>
      document.head.querySelector(sel)?.getAttribute('content') ??
      document.head.querySelector(sel)?.getAttribute('href');

    expect(meta('link[rel="canonical"]')).toBe('https://example.com/guide/getting-started');
    expect(meta('meta[property="og:title"]')).toBe('Getting Started — Docs');
    expect(meta('meta[property="og:type"]')).toBe('website');
    expect(meta('meta[property="og:site_name"]')).toBe('Docs');
    expect(meta('meta[name="twitter:card"]')).toBe('summary');
    expect(meta('meta[name="twitter:site"]')).toBe('@docs');
    handle.destroy();
  });

  it('marks blog posts as articles with JSON-LD, and cleans up on leaving', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = await mount(host, {
      manifest: seoManifest(),
      fetchText: seoFetch,
      blog: true,
      seo: { siteUrl: 'https://example.com/' },
    });

    handle.navigate('/blog/hello');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'article',
    );
    const ld = document.head.querySelector('script[type="application/ld+json"]');
    expect(ld).toBeTruthy();
    expect(JSON.parse(ld!.textContent!)).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'Hello — Docs',
      datePublished: '2026-02-01T00:00:00.000Z',
      author: { name: 'Ada' },
    });

    handle.navigate('/guide/getting-started');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(document.head.querySelector('meta[property="article:tag"]')).toBeNull();
    handle.destroy();
  });
});

describe('defineElement', () => {
  it('registers <md-book> once and exposes observed attributes', () => {
    defineElement();
    defineElement();
    const ctor = customElements.get('md-book');
    expect(ctor).toBeTruthy();
    expect(
      (ctor as typeof HTMLElement & { observedAttributes: string[] }).observedAttributes,
    ).toContain('manifest');
  });
});
