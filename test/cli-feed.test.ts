import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFeeds } from '../src/cli/feed.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'md-book-feed-'));
  mkdirSync(join(dir, 'blog'), { recursive: true });
  writeFileSync(join(dir, 'blog', 'index.md'), '---\ntitle: Blog\n---\n');
  writeFileSync(
    join(dir, 'blog', '2026-03-01-two.md'),
    '---\ntitle: Second\ndate: 2026-03-01\ntags: [news]\ndescription: the second post\n---\nbody',
  );
  writeFileSync(
    join(dir, 'blog', '2026-01-01-one.md'),
    '---\ntitle: First\ndate: 2026-01-01\n---\nbody',
  );
  writeFileSync(join(dir, 'blog', 'undated.md'), '---\ntitle: Skip me\n---\nbody');
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('writeFeeds', () => {
  it('writes rss, atom and json feeds with newest-first dated posts', () => {
    const { written, postCount } = writeFeeds({
      contentDir: dir,
      siteUrl: 'https://example.com',
      outDir: dir,
      title: 'Example',
    });

    expect(postCount).toBe(2);
    expect(written.map((p) => p.split('/').pop())).toEqual(['feed.xml', 'atom.xml', 'feed.json']);

    const rss = readFileSync(join(dir, 'feed.xml'), 'utf8');
    expect(rss.indexOf('Second')).toBeLessThan(rss.indexOf('First')); // newest first
    expect(rss).toContain('<link>https://example.com/blog/two</link>');

    const json = JSON.parse(readFileSync(join(dir, 'feed.json'), 'utf8'));
    expect(json.items).toHaveLength(2);
    expect(json.items[0]).toMatchObject({ title: 'Second', summary: 'the second post' });
  });

  it('honours a formats subset', () => {
    const { written } = writeFeeds({
      contentDir: dir,
      siteUrl: 'https://example.com/',
      outDir: dir,
      title: 'Example',
      formats: ['json'],
    });
    expect(written).toHaveLength(1);
    expect(written[0]!.endsWith('feed.json')).toBe(true);
  });
});
