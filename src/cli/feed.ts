import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectPosts } from '../core/blog.js';
import { type FeedFormat, type FeedOptions, generateFeed } from '../core/feed.js';
import { generateManifest } from './manifest.js';

export interface WriteFeedOptions {
  contentDir: string;
  siteUrl: string;
  outDir: string;
  title: string;
  description?: string;
  language?: string;
  author?: string;
  /** Blog directory. Default `blog`. */
  dir?: string;
  formats?: FeedFormat[];
  limit?: number;
}

const FILENAME: Record<FeedFormat, string> = {
  rss: 'feed.xml',
  atom: 'atom.xml',
  json: 'feed.json',
};

/** Generates blog feeds from a content directory and writes them to `outDir`. */
export function writeFeeds(options: WriteFeedOptions): { written: string[]; postCount: number } {
  const manifest = generateManifest({ contentDir: options.contentDir, base: '/' });
  const posts = collectPosts(manifest.entries, { dir: options.dir, hideFuture: true });
  const formats = options.formats ?? ['rss', 'atom', 'json'];
  const site = options.siteUrl.endsWith('/') ? options.siteUrl : `${options.siteUrl}/`;

  const written: string[] = [];
  for (const format of formats) {
    const feedUrl = new URL(FILENAME[format], site).toString();
    const feedOptions: FeedOptions = {
      title: options.title,
      siteUrl: site,
      description: options.description,
      language: options.language,
      author: options.author,
      feedUrl,
      limit: options.limit,
    };
    const out = join(options.outDir, FILENAME[format]);
    writeFileSync(out, generateFeed(posts, feedOptions, format), 'utf8');
    written.push(out);
  }

  return { written, postCount: posts.length };
}
