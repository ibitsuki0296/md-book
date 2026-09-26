import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSite } from '../src/cli/build.js';
import { run } from '../src/cli/index.js';
import { renderSite, routeToFile } from '../src/core/site.js';
import { generateSitemap } from '../src/core/sitemap.js';

let root: string;
let content: string;
let dist: string;
let out: string;

const write = (rel: string, body: string) => {
  const file = join(content, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, body);
};
const read = (rel: string) => readFileSync(join(out, rel), 'utf8');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'md-book-ssg-'));
  content = join(root, 'content');
  dist = join(root, 'fake-dist');
  out = join(root, 'out');
  mkdirSync(join(dist, 'themes'), { recursive: true });
  writeFileSync(join(dist, 'style.css'), '/* css */');
  writeFileSync(join(dist, 'md-book.global.js'), '/* js */');
  writeFileSync(join(dist, 'themes', 'ink.css'), '/* ink */');

  write(
    'index.md',
    '---\ntitle: Home\nlayout: home\nhero:\n  text: Welcome\n  actions:\n    - text: Go\n      link: /guide/a\n---\nIntro.\n',
  );
  write(
    'guide/01-a.md',
    '---\ntitle: Alpha\ndescription: The alpha page\n---\n# Alpha\n\n## Install\n\nInline $x^2$ and\n\n```mermaid\ngraph TD; A-->B\n```\n\nSee [b](./02-b.md).\n',
  );
  write('guide/02-b.md', '---\ntitle: Beta\n---\n# Beta\n\nBody of beta.\n');
  write('guide/draft.md', '---\ndraft: true\n---\nsecret\n');
  write('blog/index.md', '---\ntitle: Blog\n---\nWelcome to the blog.\n');
  write(
    'blog/2026-01-01-one.md',
    '---\ntitle: One\ndate: 2026-01-01\ntags: [news, a b]\ncategories: [misc]\n---\nfirst post\n',
  );
  write(
    'blog/2026-01-02-two.md',
    '---\ntitle: Two\ndate: 2026-01-02\ntags: [news]\n---\nsecond post\n',
  );
  write('blog/2026-01-03-three.md', '---\ntitle: Three\ndate: 2026-01-03\n---\nthird post\n');
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('routeToFile', () => {
  it('maps routes to directory indexes and refuses traversal', () => {
    expect(routeToFile('/')).toBe('index.html');
    expect(routeToFile('/guide/a')).toBe('guide/a/index.html');
    expect(() => routeToFile('/a/../../etc')).toThrow(/outside/);
    expect(() => routeToFile('/a/..\\..\\etc')).toThrow(/outside/);
  });
});

describe('buildSite', () => {
  it('pre-renders every page with shell, content and SEO head', async () => {
    const { files, pages } = await buildSite({
      contentDir: content,
      outDir: out,
      distDir: dist,
      title: 'My Site',
      siteUrl: 'https://example.com/',
    });
    expect(pages).toBe(files.filter((f) => f.endsWith('.html')).length);
    expect(files).toEqual(
      expect.arrayContaining([
        'index.html',
        'guide/a/index.html',
        'guide/b/index.html',
        '404.html',
        'manifest.json',
        'sitemap.xml',
        'style.css',
        'md-book.global.js',
        'themes/ink.css',
        'md-book-content/guide/01-a.md',
      ]),
    );
    expect(files).not.toContain('guide/draft/index.html');

    const page = read('guide/a/index.html');
    expect(page).toMatch(/^<!doctype html>/);
    expect(page).toContain('<html lang="en">');
    expect(page).toContain('<title>Alpha — My Site</title>');
    expect(page).toContain('<meta name="description" content="The alpha page">');
    expect(page).toContain('<link rel="canonical" href="https://example.com/guide/a">');
    expect(page).toContain('<h1 id="alpha"');
    expect(page).toContain('class="md-book-toc__link"');
    expect(page).toContain('href="/guide/b"'); // relative .md link rewritten
    expect(page).toContain('<md-book manifest="/manifest.json" base="/" router="history"');
    expect(page).toContain('<script src="/md-book.global.js"></script>');
    expect(page).toContain('aria-current="page"'); // sidebar marks the current page
    expect(page).toContain('Next'); // pager

    const home = read('index.html');
    expect(home).toContain('md-book--home');
    expect(home).toContain('class="md-book-hero"');
    expect(home).toContain('Welcome');
    expect(read('404.html')).toContain('Page not found');
  });

  it('writes a manifest the runtime can use (base-relative routes, locales, contentBase)', async () => {
    await buildSite({ contentDir: content, outDir: out, distDir: dist, base: '/docs/' });
    const manifest = JSON.parse(read('manifest.json'));
    expect(manifest.base).toBe('/docs');
    expect(manifest.contentBase).toBe('/docs/md-book-content');
    expect(manifest.entries.map((e: { path: string }) => e.path)).toContain('/guide/a');
    expect(read('guide/a/index.html')).toContain('href="/docs/guide/b"');
    expect(read('guide/a/index.html')).toContain('src="/docs/md-book.global.js"');
    expect(read('guide/a/index.html')).toContain('base="/docs"');
  });

  it('generates blog list, pagination, tag and category pages', async () => {
    await buildSite({ contentDir: content, outDir: out, distDir: dist, blog: { perPage: 2 } });
    expect(existsSync(join(out, 'blog/index.html'))).toBe(true);
    expect(read('blog/index.html')).toContain('Welcome to the blog.'); // the section's own page comes first
    expect(read('blog/index.html')).toContain('md-book-post__title');
    expect(read('blog/index.html')).toContain('blog-per-page="2"');
    expect(existsSync(join(out, 'blog/page/2/index.html'))).toBe(true);
    expect(existsSync(join(out, 'blog/page/3/index.html'))).toBe(false);
    expect(existsSync(join(out, 'tags/index.html'))).toBe(true);
    expect(read('tags/news/index.html')).toContain('Two');
    expect(existsSync(join(out, 'tags/a-b/index.html'))).toBe(true);
    expect(existsSync(join(out, 'categories/misc/index.html'))).toBe(true);
    // Posts are articles with JSON-LD.
    expect(read('blog/one/index.html')).toContain('"@type":"BlogPosting"');
  });

  it('adds sitemap, feeds, search index and runtime switches when asked', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true); // "katex is not installed" notice
    await buildSite({
      contentDir: content,
      outDir: out,
      distDir: dist,
      siteUrl: 'https://example.com/',
      blog: true,
      search: true,
      math: true,
      mermaid: true,
      theme: 'dark',
      locale: 'ja',
      headHTML: '<meta name="x" content="y">',
    });
    const sitemap = read('sitemap.xml');
    expect(sitemap).toContain('<loc>https://example.com/guide/a</loc>');
    expect(sitemap).not.toContain('404');
    expect(sitemap).not.toContain('draft');
    expect(existsSync(join(out, 'feed.xml'))).toBe(true);
    expect(JSON.parse(read('search-index.json')).docs.length).toBeGreaterThan(3);

    const page = read('guide/a/index.html');
    expect(page).toMatch(/<md-book [^>]*\bsearch\b/);
    expect(page).toMatch(/<md-book [^>]*\bmath\b/);
    expect(page).toMatch(/<md-book [^>]*\bmermaid\b/);
    expect(page).toContain('theme="dark"');
    expect(page).toContain('lang="ja"');
    expect(page).toContain('<html lang="ja">');
    expect(page).toContain('<meta name="x" content="y">');
    expect(page).toContain('katex.min.css');
    expect(page).toContain('<pre class="md-book-mermaid">');
    expect(page).toContain('<span class="md-book-math">x^2</span>');
    expect(page).toContain('site-url="https://example.com/"');
    expect(page).toContain('次へ'); // ja UI strings in the pre-rendered shell
  });

  it('pre-renders math through a supplied renderer', async () => {
    await buildSite({
      contentDir: content,
      outDir: out,
      distDir: dist,
      math: true,
      mathRenderer: (tex) => `<b>${tex}</b>`,
    });
    expect(read('guide/a/index.html')).toContain('md-book-math--rendered"><b>x^2</b>');
  });

  it('can emit plain static HTML without the runtime', async () => {
    const { files } = await buildSite({
      contentDir: content,
      outDir: out,
      distDir: dist,
      runtime: false,
      search: true,
    });
    expect(files).not.toContain('manifest.json');
    expect(files).not.toContain('md-book.global.js');
    expect(files).not.toContain('search-index.json');
    const page = read('guide/a/index.html');
    expect(page).not.toContain('<script src=');
    expect(page).not.toContain('<md-book');
    expect(page).toContain('class="md-book-static"');
    expect(page).toContain('Alpha');
  });

  it('refuses an output directory inside (or around) the content directory', async () => {
    await expect(
      buildSite({ contentDir: content, outDir: join(content, 'out'), distDir: dist }),
    ).rejects.toThrow(/inside/);
    await expect(buildSite({ contentDir: content, outDir: root, distDir: dist })).rejects.toThrow(
      /contain/,
    );
  });
});

describe('localised build', () => {
  beforeEach(() => {
    write('ja/index.md', '---\ntitle: ホーム\n---\n日本語のホーム\n');
    write('ja/guide/01-a.md', '---\ntitle: アルファ\n---\n# アルファ\n\n本文\n');
    write(
      'ja/blog/2026-01-05-ichi.md',
      '---\ntitle: 一\ndate: 2026-01-05\ntags: [お知らせ]\n---\n投稿\n',
    );
  });

  it('renders each locale with its own chrome, alternates and sitemap links', async () => {
    await buildSite({
      contentDir: content,
      outDir: out,
      distDir: dist,
      siteUrl: 'https://example.com/',
      locales: ['en', 'ja'],
      blog: true,
    });
    const en = read('guide/a/index.html');
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('hreflang="ja" href="https://example.com/ja/guide/a"');
    expect(en).toContain('hreflang="x-default" href="https://example.com/guide/a"');
    expect(en).toContain('class="md-book-lang__select"');
    expect(en).not.toContain('アルファ'); // the sidebar only lists English pages

    const ja = read('ja/guide/a/index.html');
    expect(ja).toContain('<html lang="ja">');
    expect(ja).toContain('アルファ');
    expect(ja).toContain('property="og:locale" content="ja"');
    expect(ja).toContain('<option value="ja" lang="ja" selected>');
    expect(ja).toContain('href="/ja"'); // brand → the locale's home

    // A locale root without translated siblings still exists; blog routes are per locale.
    expect(existsSync(join(out, 'ja/index.html'))).toBe(true);
    expect(existsSync(join(out, 'ja/blog/index.html'))).toBe(true);
    expect(existsSync(join(out, 'ja/tags/お知らせ/index.html'))).toBe(true);
    expect(read('ja/blog/index.html')).toContain('一');
    expect(read('blog/index.html')).not.toContain('一');

    const manifest = JSON.parse(read('manifest.json'));
    expect(manifest.locales.map((l: { code: string }) => l.code)).toEqual(['en', 'ja']);
    const sitemap = read('sitemap.xml');
    expect(sitemap).toContain('xmlns:xhtml');
    expect(sitemap).toContain(
      '<xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/guide/a"/>',
    );
    // per-locale feeds
    expect(existsSync(join(out, 'feed.xml'))).toBe(true);
    expect(read('ja/feed.xml')).toContain('一');
    expect(read('feed.xml')).not.toContain('<title>一</title>');
  });
});

describe('renderSite (pure)', () => {
  it('needs no filesystem: sources come from readSource', () => {
    const pages = renderSite({
      manifest: {
        version: 1,
        base: '/',
        generatedAt: '',
        entries: [
          { file: 'index.md', path: '/', frontMatter: { title: 'Hi' } },
          { file: 'x.md', path: '/x', frontMatter: {} },
        ],
      },
      readSource: (e) => `# ${e.file}\n`,
    });
    expect(pages.map((p) => p.file).sort()).toEqual(['404.html', 'index.html', 'x/index.html']);
    expect(pages.find((p) => p.route === '/x')?.html).toContain('x.md');
  });

  it('escapes hostile titles and hrefs in the document', () => {
    const pages = renderSite({
      manifest: {
        version: 1,
        base: '/',
        generatedAt: '',
        entries: [
          { file: 'index.md', path: '/', frontMatter: { title: '"><script>alert(1)</script>' } },
        ],
      },
      readSource: () => 'body',
      seo: { siteUrl: 'https://e.com/"><x' },
    });
    const html = pages[0]!.html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('"><x');
  });
});

describe('generateSitemap', () => {
  it('escapes URLs', () => {
    expect(generateSitemap([{ loc: 'https://e.com/?a=1&b=2' }])).toContain('a=1&amp;b=2');
  });
});

describe('md-book build (CLI)', () => {
  it('builds from flags', async () => {
    const orig = process.stdout.write.bind(process.stdout);
    const chunks: string[] = [];
    process.stdout.write = ((c: string) => {
      chunks.push(String(c));
      return true;
    }) as typeof process.stdout.write;
    try {
      const code = await run([
        'build',
        content,
        '--out',
        out,
        '--dist',
        dist,
        '--title',
        'CLI',
        '--lang',
        'ja',
        '--locales',
        'en,ja:日本語',
        '--blog',
        '--blog-per-page',
        '1',
        '--search',
        '--site-url',
        'https://e.com/',
      ]);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = orig;
    }
    expect(chunks.join('')).toMatch(/built \d+ pages/);
    const manifest = JSON.parse(read('manifest.json'));
    expect(manifest.title).toBe('CLI');
    expect(manifest.locales[1]).toMatchObject({ code: 'ja', label: '日本語' });
    expect(existsSync(join(out, 'search-index.json'))).toBe(true);
    expect(existsSync(join(out, 'blog/page/3/index.html'))).toBe(true);
    expect(read('index.html')).toContain('blog-per-page="1"');
  });

  it('search-index and manifest --locales work as commands', async () => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      expect(
        await run(['search-index', content, '--out', join(root, 's.json'), '--max-chars', '50']),
      ).toBe(0);
      expect(
        await run(['manifest', content, '--out', join(root, 'm.json'), '--locales', 'en,ja']),
      ).toBe(0);
    } finally {
      process.stdout.write = orig;
    }
    const index = JSON.parse(readFileSync(join(root, 's.json'), 'utf8'));
    expect(index.docs.every((d: { text: string }) => d.text.length <= 50)).toBe(true);
    expect(index.docs.find((d: { path: string }) => d.path === '/guide/a').title).toBe('Alpha');
    expect(JSON.parse(readFileSync(join(root, 'm.json'), 'utf8')).defaultLocale).toBe('en');
  });
});
