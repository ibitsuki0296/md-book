import type { BlogPost } from './blog.js';

export type FeedFormat = 'rss' | 'atom' | 'json';

export interface FeedOptions {
  /** Site title. */
  title: string;
  /** Absolute site origin + base, e.g. `https://example.com/` or `https://example.com/docs/`. */
  siteUrl: string;
  description?: string;
  /** Absolute URL of the feed file itself (used for `atom:link rel=self`). */
  feedUrl?: string;
  language?: string;
  author?: string;
  /** Cap the number of items. Default 20. */
  limit?: number;
  /** Overrides "now" for the feed's build timestamp (testing). */
  now?: Date;
}

/** Serializes blog posts into an RSS 2.0, Atom 1.0, or JSON Feed 1.1 document. */
export function generateFeed(posts: BlogPost[], options: FeedOptions, format: FeedFormat): string {
  const limit = options.limit ?? 20;
  const items = posts.slice(0, limit);
  const site = ensureTrailingSlash(options.siteUrl);
  const updated = options.now ?? items[0]?.date ?? new Date();

  if (format === 'json') return jsonFeed(items, options, site, updated);
  if (format === 'atom') return atomFeed(items, options, site, updated);
  return rssFeed(items, options, site, updated);
}

function rssFeed(items: BlogPost[], o: FeedOptions, site: string, updated: Date): string {
  const self = o.feedUrl
    ? `<atom:link href="${xml(o.feedUrl)}" rel="self" type="application/rss+xml"/>`
    : '';
  const entries = items
    .map((post) => {
      const url = abs(site, post.path);
      return [
        '    <item>',
        `      <title>${xml(post.title)}</title>`,
        `      <link>${xml(url)}</link>`,
        `      <guid isPermaLink="true">${xml(url)}</guid>`,
        `      <pubDate>${post.date.toUTCString()}</pubDate>`,
        ...post.tags.map((t) => `      <category>${xml(t)}</category>`),
        post.summary ? `      <description>${xml(post.summary)}</description>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xml(o.title)}</title>`,
    `    <link>${xml(site)}</link>`,
    `    <description>${xml(o.description ?? o.title)}</description>`,
    o.language ? `    <language>${xml(o.language)}</language>` : '',
    `    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>`,
    self ? `    ${self}` : '',
    entries,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function atomFeed(items: BlogPost[], o: FeedOptions, site: string, updated: Date): string {
  const feedUrl = o.feedUrl ?? `${site}atom.xml`;
  const entries = items
    .map((post) => {
      const url = abs(site, post.path);
      return [
        '  <entry>',
        `    <title>${xml(post.title)}</title>`,
        `    <link href="${xml(url)}"/>`,
        `    <id>${xml(url)}</id>`,
        `    <updated>${(post.entry.mtime ? new Date(post.entry.mtime) : post.date).toISOString()}</updated>`,
        `    <published>${post.date.toISOString()}</published>`,
        post.author ? `    <author><name>${xml(post.author)}</name></author>` : '',
        ...post.tags.map((t) => `    <category term="${xml(t)}"/>`),
        post.summary ? `    <summary>${xml(post.summary)}</summary>` : '',
        '  </entry>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${xml(o.title)}</title>`,
    o.description ? `  <subtitle>${xml(o.description)}</subtitle>` : '',
    `  <link href="${xml(site)}"/>`,
    `  <link href="${xml(feedUrl)}" rel="self"/>`,
    `  <id>${xml(site)}</id>`,
    `  <updated>${updated.toISOString()}</updated>`,
    o.author ? `  <author><name>${xml(o.author)}</name></author>` : '',
    entries,
    '</feed>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function jsonFeed(items: BlogPost[], o: FeedOptions, site: string, _updated: Date): string {
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: o.title,
    home_page_url: site,
    feed_url: o.feedUrl,
    description: o.description,
    language: o.language,
    authors: o.author ? [{ name: o.author }] : undefined,
    items: items.map((post) => ({
      id: abs(site, post.path),
      url: abs(site, post.path),
      title: post.title,
      summary: post.summary,
      date_published: post.date.toISOString(),
      tags: post.tags.length > 0 ? post.tags : undefined,
      authors: post.author ? [{ name: post.author }] : undefined,
      image: post.cover ? abs(site, post.cover) : undefined,
    })),
  };
  return `${JSON.stringify(feed, null, 2)}\n`;
}

function abs(site: string, path: string): string {
  return new URL(path.replace(/^\//, ''), site).toString();
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
