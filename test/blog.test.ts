import { describe, expect, it } from 'vitest';
import {
  collectPosts,
  generateFeed,
  groupByTag,
  makeEntry,
  paginate,
  toDate,
} from '../src/index.js';
import type { BlogPost, FrontMatter } from '../src/index.js';

const post = (file: string, fm: FrontMatter) => makeEntry(file, fm);

const ENTRIES = [
  post('index.md', { title: 'Home' }),
  post('blog/index.md', { title: 'Blog' }),
  post('blog/2026-03-01-newest.md', { title: 'Newest', date: '2026-03-01', tags: ['news', 'x'] }),
  post('blog/2026-01-15-middle.md', { title: 'Middle', date: '2026-01-15', tags: ['x'] }),
  post('blog/2025-12-01-oldest.md', { title: 'Oldest', date: '2025-12-01' }),
  post('blog/no-date.md', { title: 'No date' }),
  post('blog/draft.md', { title: 'Draft', date: '2026-02-01', draft: true }),
  post('blog/2099-01-01-future.md', { title: 'Future', date: '2099-01-01' }),
  post('guide/intro.md', { title: 'Intro' }),
];

describe('toDate', () => {
  it('accepts Date, ISO string and epoch', () => {
    expect(toDate(new Date('2026-01-01'))).toBeInstanceOf(Date);
    expect(toDate('2026-01-01')?.getUTCFullYear()).toBe(2026);
    expect(toDate(0)?.getTime()).toBe(0);
  });
  it('rejects junk', () => {
    expect(toDate('not a date')).toBeUndefined();
    expect(toDate({})).toBeUndefined();
  });
});

describe('collectPosts', () => {
  it('returns dated posts under blog/, newest first, excluding the index, drafts and non-dated', () => {
    const posts = collectPosts(ENTRIES);
    expect(posts.map((p) => p.title)).toEqual(['Future', 'Newest', 'Middle', 'Oldest']);
  });

  it('can hide future-dated posts', () => {
    const posts = collectPosts(ENTRIES, { hideFuture: true, now: new Date('2026-06-01') });
    expect(posts.map((p) => p.title)).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  it('can include drafts and honour a custom dir', () => {
    const withDraft = collectPosts(ENTRIES, {
      includeDrafts: true,
      hideFuture: true,
      now: new Date('2030-01-01'),
    });
    expect(withDraft.map((p) => p.title)).toContain('Draft');
  });

  it('normalises tags and exposes an ISO date', () => {
    const newest = collectPosts(ENTRIES).find((p) => p.title === 'Newest')!;
    expect(newest.tags).toEqual(['news', 'x']);
    expect(newest.dateISO).toBe('2026-03-01');
  });
});

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  it('splits into pages and clamps the page number', () => {
    expect(paginate(items, 3, 1)).toMatchObject({
      items: [1, 2, 3],
      page: 1,
      pageCount: 3,
      total: 7,
    });
    expect(paginate(items, 3, 2).items).toEqual([4, 5, 6]);
    expect(paginate(items, 3, 99)).toMatchObject({ items: [7], page: 3 });
    expect(paginate(items, 3, 0).page).toBe(1);
  });
  it('always yields one page for an empty list', () => {
    expect(paginate([], 10)).toMatchObject({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});

describe('groupByTag', () => {
  it('buckets posts by tag, most-used first', () => {
    const groups = groupByTag(collectPosts(ENTRIES));
    expect(groups.map((g) => [g.slug, g.posts.length])).toEqual([
      ['x', 2],
      ['news', 1],
    ]);
  });
});

describe('generateFeed', () => {
  const posts: BlogPost[] = collectPosts(ENTRIES, {
    hideFuture: true,
    now: new Date('2026-06-01'),
  });
  const opts = {
    title: 'My Blog',
    siteUrl: 'https://example.com/',
    description: 'news & notes',
    feedUrl: 'https://example.com/feed.xml',
    now: new Date('2026-06-01T00:00:00Z'),
  };

  it('emits valid-looking RSS with absolute links', () => {
    const rss = generateFeed(posts, opts, 'rss');
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain('<link>https://example.com/blog/newest</link>');
    expect(rss).toContain('<title>Newest</title>');
    expect(rss).toContain('rel="self"');
  });

  it('emits Atom with entry ids', () => {
    const atom = generateFeed(posts, opts, 'atom');
    expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(atom).toContain('<id>https://example.com/blog/middle</id>');
  });

  it('emits JSON Feed 1.1', () => {
    const json = JSON.parse(generateFeed(posts, opts, 'json'));
    expect(json.version).toBe('https://jsonfeed.org/version/1.1');
    expect(json.items).toHaveLength(3);
    expect(json.items[0]).toMatchObject({
      title: 'Newest',
      url: 'https://example.com/blog/newest',
    });
  });

  it('escapes XML metacharacters in titles', () => {
    const spicy = collectPosts([
      post('blog/2026-05-01-x.md', { title: 'a & b <c>', date: '2026-05-01' }),
    ]);
    expect(generateFeed(spicy, opts, 'rss')).toContain('<title>a &amp; b &lt;c&gt;</title>');
  });

  it('honours the item limit', () => {
    expect(JSON.parse(generateFeed(posts, { ...opts, limit: 1 }, 'json')).items).toHaveLength(1);
  });
});
