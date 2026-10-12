// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_DEFAULTS, hidesSidebar, isBlogRoute } from '../src/core/blog-views.js';
import { renderSite } from '../src/core/site.js';
import { MANIFEST_VERSION, type Manifest, makeEntry } from '../src/index.js';
import { defineElement, mount } from '../src/runtime/index.js';

const FILES: Record<string, string> = {
  'index.md': '---\ntitle: Home\n---\n# Home\n',
  'guide/01-start.md': '---\ntitle: Start\n---\n# Start\n\n## Install\n\ntext\n',
  'guide/02-wide.md': '---\ntitle: Wide\nsidebar: false\n---\n# Wide\n\n## Part\n\ntext\n',
  'blog/index.md': '---\ntitle: Blog\n---\nWelcome.\n',
  'blog/2026-01-01-one.md':
    '---\ntitle: One\ndate: 2026-01-01\ntags: [news]\n---\n# One\n\n## Body\n',
  'blog/2026-01-02-two.md': '---\ntitle: Two\ndate: 2026-01-02\n---\n# Two\n',
};

const manifest: Manifest = {
  version: MANIFEST_VERSION,
  base: '/',
  contentBase: '/',
  generatedAt: '2026-01-01T00:00:00.000Z',
  entries: Object.keys(FILES).map((file) => {
    const fm = /title: (.+)/.exec(FILES[file] ?? '')?.[1] ?? file;
    const date = /date: (\S+)/.exec(FILES[file] ?? '')?.[1];
    const tags = /tags: \[(.+)\]/.exec(FILES[file] ?? '')?.[1]?.split(',');
    return makeEntry(file, { title: fm, ...(date ? { date } : {}), ...(tags ? { tags } : {}) });
  }),
};

const fetchText = vi.fn(async (url: string) => {
  const body = FILES[new URL(url).pathname.replace(/^\//, '')];
  if (body === undefined) throw new Error('404');
  return body;
});

const site = (blog: boolean | { sidebar: boolean }) =>
  renderSite({ manifest, readSource: (e) => FILES[e.file] ?? '', blog });
const page = (pages: ReturnType<typeof site>, route: string) =>
  pages.find((p) => p.route === route)?.html ?? '';

describe('hidesSidebar', () => {
  const blog = { ...BLOG_DEFAULTS, sidebar: false };

  it('recognises blog routes, including taxonomy', () => {
    for (const route of ['/blog', '/blog/page/2', '/blog/post', '/tags/news', '/categories']) {
      expect(isBlogRoute(route, blog)).toBe(true);
    }
    for (const route of ['/', '/guide/start', '/blogging']) {
      expect(isBlogRoute(route, blog)).toBe(false);
    }
  });

  it('follows the blog config and the page front matter', () => {
    expect(hidesSidebar('/blog/post', undefined, blog)).toBe(true);
    expect(hidesSidebar('/blog/post', undefined, BLOG_DEFAULTS)).toBe(false);
    expect(hidesSidebar('/guide/start', undefined, blog)).toBe(false);
    expect(hidesSidebar('/guide/start', { sidebar: false }, null)).toBe(true);
    expect(hidesSidebar('/guide/start', { sidebar: true }, null)).toBe(false);
  });
});

describe('static build', () => {
  it('keeps the sidebar on blog pages by default', () => {
    const pages = site(true);
    expect(page(pages, '/blog')).toContain('md-book-sidebar__link');
    expect(page(pages, '/blog')).not.toContain('md-book--no-sidebar');
    expect(page(pages, '/blog')).not.toContain('blog-sidebar');
  });

  it('drops the sidebar on every blog route when blog.sidebar is false', () => {
    const pages = site({ sidebar: false });
    for (const route of ['/blog', '/blog/one', '/tags', '/tags/news']) {
      const html = page(pages, route);
      expect(html, route).toContain('md-book--no-sidebar');
      expect(html, route).not.toContain('md-book-sidebar__link');
    }
    expect(page(pages, '/blog/one')).toContain('md-book-toc__link');
    expect(page(pages, '/blog')).toContain('blog-sidebar="false"');
    // everything else keeps its sidebar
    expect(page(pages, '/guide/start')).toContain('md-book-sidebar__link');
    expect(page(pages, '/guide/start')).not.toContain('md-book--no-sidebar');
  });

  it('honours front matter `sidebar: false` on a single page', () => {
    const pages = site(true);
    expect(page(pages, '/guide/wide')).toContain('md-book--no-sidebar');
    expect(page(pages, '/guide/wide')).not.toContain('md-book-sidebar__link');
    expect(page(pages, '/guide/start')).toContain('md-book-sidebar__link');
  });
});

describe('runtime', () => {
  beforeEach(() => {
    fetchText.mockClear();
    document.body.innerHTML = '<div id="app"></div>';
  });

  const root = () => document.querySelector('.md-book') as HTMLElement;

  it('toggles the sidebar per route', async () => {
    window.history.replaceState({}, '', '/blog/one');
    const handle = await mount('#app', { manifest, fetchText, blog: { sidebar: false } });
    expect(root().classList.contains('md-book--no-sidebar')).toBe(true);
    expect(document.querySelector('.md-book-sidebar__link')).toBeNull();
    expect(document.querySelector<HTMLElement>('.md-book-menu-toggle')?.hidden).toBe(true);

    handle.navigate('/guide/start');
    await vi.waitFor(() =>
      expect(document.querySelector('article h1')?.textContent).toContain('Start'),
    );
    expect(root().classList.contains('md-book--no-sidebar')).toBe(false);
    expect(document.querySelector('.md-book-sidebar__link')).not.toBeNull();

    handle.navigate('/guide/wide');
    await vi.waitFor(() => expect(root().classList.contains('md-book--no-sidebar')).toBe(true));

    handle.navigate('/blog');
    await vi.waitFor(() =>
      expect(document.querySelector('.md-book-post-list, .md-book-blog')).not.toBeNull(),
    );
    expect(root().classList.contains('md-book--no-sidebar')).toBe(true);
    handle.destroy();
  });

  it('reads the blog-sidebar attribute on <md-book>', async () => {
    defineElement();
    window.history.replaceState({}, '', '/blog/one');
    const el = document.createElement('md-book');
    el.setAttribute('blog', '');
    el.setAttribute('blog-sidebar', 'false');
    // biome-ignore lint/suspicious/noExplicitAny: test seam
    (globalThis as any).fetch = async (url: string) => {
      const path = new URL(url, 'http://localhost').pathname;
      if (path.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
      return new Response(FILES[path.replace(/^\//, '')] ?? '', {
        status: FILES[path.replace(/^\//, '')] ? 200 : 404,
      });
    };
    document.body.append(el);
    await vi.waitFor(() => expect(el.querySelector('article h1')?.textContent).toContain('One'));
    expect(el.querySelector('.md-book')?.classList.contains('md-book--no-sidebar')).toBe(true);
    el.remove();
  });
});
