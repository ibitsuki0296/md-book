import { describe, expect, it } from 'vitest';
import type { FrontMatter } from '../src/index.js';
import {
  assertManifest,
  buildNav,
  buildSidebar,
  entryTitle,
  fileToRoutePath,
  flattenPages,
  getPrevNext,
  makeEntry,
  orderFromFilename,
  resolveRoutes,
} from '../src/index.js';

const e = (file: string, fm: FrontMatter = {}) => makeEntry(file, fm);

describe('fileToRoutePath', () => {
  it('drops the extension and leading ./', () => {
    expect(fileToRoutePath('./guide/intro.md')).toBe('/guide/intro');
    expect(fileToRoutePath('guide/intro.markdown')).toBe('/guide/intro');
  });

  it('maps index / README to the directory route', () => {
    expect(fileToRoutePath('index.md')).toBe('/');
    expect(fileToRoutePath('guide/README.md')).toBe('/guide');
  });

  it('strips NN- ordering prefixes from each segment', () => {
    expect(fileToRoutePath('01-guide/03-setup.md')).toBe('/guide/setup');
    expect(fileToRoutePath('2.advanced/1_intro.md')).toBe('/advanced/intro');
  });

  it('strips YYYY-MM-DD- blog date prefixes without mangling the slug', () => {
    expect(fileToRoutePath('blog/2026-02-01-hello-world.md')).toBe('/blog/hello-world');
    expect(fileToRoutePath('blog/2026-02-01.first-post.md')).toBe('/blog/first-post');
  });

  it('applies a site base path', () => {
    expect(fileToRoutePath('guide/intro.md', '/docs/')).toBe('/docs/guide/intro');
    expect(fileToRoutePath('index.md', '/docs')).toBe('/docs');
  });
});

describe('orderFromFilename', () => {
  it('reads a numeric prefix', () => {
    expect(orderFromFilename('guide/03-setup.md')).toBe(3);
    expect(orderFromFilename('10. Deep Dive.md')).toBe(10);
  });
  it('returns undefined without a prefix', () => {
    expect(orderFromFilename('guide/setup.md')).toBeUndefined();
  });
  it('ignores YYYY-MM-DD- date prefixes', () => {
    expect(orderFromFilename('blog/2026-02-01-hello-world.md')).toBeUndefined();
  });
});

describe('makeEntry', () => {
  it('resolves path and order together', () => {
    const entry = makeEntry('guide/02-setup.md', { title: 'Setup' });
    expect(entry).toMatchObject({ file: 'guide/02-setup.md', path: '/guide/setup', order: 2 });
  });

  it('lets front matter order win over the filename prefix', () => {
    expect(makeEntry('guide/02-setup.md', { order: 99 }).order).toBe(99);
  });

  it('honours a relative front matter slug', () => {
    expect(makeEntry('guide/setup.md', { slug: 'installation' }).path).toBe('/guide/installation');
  });

  it('honours an absolute front matter slug', () => {
    expect(makeEntry('deep/nested/page.md', { slug: '/top' }).path).toBe('/top');
  });
});

describe('entryTitle', () => {
  it('prefers front matter title', () => {
    expect(entryTitle(e('guide/setup.md', { title: 'Install Guide' }))).toBe('Install Guide');
  });
  it('prettifies the last segment as a fallback', () => {
    expect(entryTitle(e('guide/getting-started.md'))).toBe('Getting Started');
  });
});

describe('resolveRoutes', () => {
  it('builds a nested tree with intermediate directory nodes', () => {
    const root = resolveRoutes([e('guide/advanced/plugins.md')]);
    expect(root.children[0]?.segment).toBe('guide');
    expect(root.children[0]?.entry).toBeUndefined();
    expect(root.children[0]?.children[0]?.segment).toBe('advanced');
    expect(root.children[0]?.children[0]?.children[0]?.entry?.path).toBe('/guide/advanced/plugins');
  });

  it('sorts siblings by order, then title', () => {
    const root = resolveRoutes([
      e('guide/03-c.md', { title: 'C' }),
      e('guide/01-a.md', { title: 'A' }),
      e('guide/beta.md', { title: 'Beta' }),
      e('guide/alpha.md', { title: 'Alpha' }),
    ]);
    const titles = root.children[0]?.children.map((c) => c.title);
    expect(titles).toEqual(['A', 'C', 'Alpha', 'Beta']);
  });

  it('attaches an index page to its directory node', () => {
    const root = resolveRoutes([e('guide/index.md', { title: 'Guide Home' }), e('guide/x.md')]);
    expect(root.children[0]?.path).toBe('/guide');
    expect(root.children[0]?.entry?.path).toBe('/guide');
    expect(root.children[0]?.title).toBe('Guide Home');
  });
});

describe('buildNav', () => {
  it('emits one item per top-level section, linking to its landing page', () => {
    const nav = buildNav([
      e('index.md', { title: 'Home' }),
      e('guide/01-intro.md', { title: 'Intro' }),
      e('guide/02-next.md', { title: 'Next' }),
      e('api/ref.md', { title: 'Reference' }),
    ]);
    // `guide` has no index page -> label is the prettified directory name.
    // `api` likewise; both link to their first descendant page. Sorted by label.
    expect(nav).toEqual([
      { text: 'Api', link: '/api/ref' },
      { text: 'Guide', link: '/guide/intro' },
    ]);
  });

  it('uses a section index page title and order when present', () => {
    const nav = buildNav([
      e('guide/index.md', { title: 'Guide', order: 1 }),
      e('guide/intro.md', { title: 'Intro' }),
      e('api/index.md', { title: 'API Reference', order: 2 }),
    ]);
    expect(nav).toEqual([
      { text: 'Guide', link: '/guide' },
      { text: 'API Reference', link: '/api' },
    ]);
  });
});

describe('buildSidebar', () => {
  const entries = [
    e('guide/01-intro.md', { title: 'Intro' }),
    e('guide/02-setup.md', { title: 'Setup' }),
    e('guide/draft.md', { title: 'WIP', draft: true }),
    e('api/ref.md', { title: 'Reference' }),
  ];

  it('returns the whole tree by default, excluding drafts', () => {
    const sidebar = buildSidebar(entries);
    expect(sidebar.map((n) => n.segment)).toEqual(['api', 'guide']);
    const guide = sidebar.find((n) => n.segment === 'guide');
    expect(guide?.children.map((c) => c.title)).toEqual(['Intro', 'Setup']);
  });

  it('scopes to a section', () => {
    const sidebar = buildSidebar(entries, { section: '/guide' });
    expect(sidebar.map((n) => n.title)).toEqual(['Intro', 'Setup']);
  });

  it('can include drafts', () => {
    const sidebar = buildSidebar(entries, { section: '/guide', includeDrafts: true });
    expect(sidebar.map((n) => n.title)).toEqual(['Intro', 'Setup', 'WIP']);
  });
});

describe('flattenPages / getPrevNext', () => {
  const entries = [
    e('index.md', { title: 'Home' }),
    e('guide/01-intro.md', { title: 'Intro' }),
    e('guide/02-setup.md', { title: 'Setup' }),
    e('api/ref.md', { title: 'Reference' }),
  ];
  const pages = flattenPages(resolveRoutes(entries).children);

  it('orders pages depth-first by the tree sort', () => {
    expect(pages.map((p) => p.path)).toEqual(['/api/ref', '/guide/intro', '/guide/setup']);
  });

  it('resolves prev / next around a page', () => {
    expect(getPrevNext(pages, '/guide/intro')).toEqual({
      prev: { path: '/api/ref', title: 'Reference' },
      next: { path: '/guide/setup', title: 'Setup' },
    });
  });

  it('omits prev at the start and next at the end', () => {
    expect(getPrevNext(pages, '/api/ref').prev).toBeUndefined();
    expect(getPrevNext(pages, '/guide/setup').next).toBeUndefined();
  });

  it('returns empty for an unknown path', () => {
    expect(getPrevNext(pages, '/nope')).toEqual({});
  });
});

describe('assertManifest', () => {
  const good = {
    version: 1,
    base: '/',
    generatedAt: '2026-01-01T00:00:00.000Z',
    entries: [{ file: 'a.md', path: '/a', frontMatter: {} }],
  };

  it('accepts a well-formed manifest', () => {
    expect(() => assertManifest(structuredClone(good))).not.toThrow();
  });

  it('rejects a wrong version', () => {
    expect(() => assertManifest({ ...good, version: 2 })).toThrow(/unsupported version/);
  });

  it('rejects malformed entries', () => {
    expect(() => assertManifest({ ...good, entries: [{ file: 'a.md' }] })).toThrow(/path must be/);
  });
});
