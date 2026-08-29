import GithubSlugger from 'github-slugger';
import { type ManifestEntry, entryTitle } from './content.js';

export interface BlogOptions {
  /** Directory (route segment) that holds posts. Default `blog`. */
  dir?: string;
  /** Include posts with `draft: true`. Default `false`. */
  includeDrafts?: boolean;
  /** Drop posts whose date is in the future. Default `false`. */
  hideFuture?: boolean;
  /** Reference "now" for future filtering / testing. Default `new Date()`. */
  now?: Date;
}

export interface BlogPost {
  entry: ManifestEntry;
  path: string;
  title: string;
  date: Date;
  /** ISO `YYYY-MM-DD`. */
  dateISO: string;
  tags: string[];
  categories: string[];
  author?: string;
  /** From front matter `description` (list views do not render the body). */
  summary?: string;
  cover?: string;
}

export interface Taxonomy {
  /** Original label. */
  name: string;
  /** URL-safe slug. */
  slug: string;
  posts: BlogPost[];
}

export interface Paginated<T> {
  items: T[];
  /** 1-based page number. */
  page: number;
  pageCount: number;
  total: number;
}

/** Parses a front matter date value (Date from YAML, or a string) into a Date. */
export function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** Collects posts under the blog directory, newest first. */
export function collectPosts(entries: ManifestEntry[], options: BlogOptions = {}): BlogPost[] {
  const dir = options.dir ?? 'blog';
  const now = options.now ?? new Date();
  const prefix = `/${dir}/`;

  const posts: BlogPost[] = [];
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) continue; // excludes the section index itself
    const fm = entry.frontMatter;
    if (fm.draft === true && !options.includeDrafts) continue;
    const date = toDate(fm.date);
    if (!date) continue;
    if (options.hideFuture && date.getTime() > now.getTime()) continue;

    posts.push({
      entry,
      path: entry.path,
      title: entryTitle(entry),
      date,
      dateISO: date.toISOString().slice(0, 10),
      tags: toStringArray(fm.tags),
      categories: toStringArray(fm.categories),
      author: typeof fm.author === 'string' ? fm.author : undefined,
      summary: typeof fm.description === 'string' ? fm.description : undefined,
      cover: typeof fm.cover === 'string' ? fm.cover : undefined,
    });
  }

  posts.sort((a, b) => b.date.getTime() - a.date.getTime());
  return posts;
}

/** Splits a list into pages of `perPage` (>= 1). Page 1 is always present. */
export function paginate<T>(items: T[], perPage: number, page = 1): Paginated<T> {
  const size = Math.max(1, Math.floor(perPage));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    total: items.length,
  };
}

/** Groups posts by tag, sorted by post count then name. */
export function groupByTag(posts: BlogPost[]): Taxonomy[] {
  return groupBy(posts, (p) => p.tags);
}

/** Groups posts by category, sorted by post count then name. */
export function groupByCategory(posts: BlogPost[]): Taxonomy[] {
  return groupBy(posts, (p) => p.categories);
}

/** Finds one taxonomy bucket by its slug. */
export function findTaxonomy(list: Taxonomy[], slug: string): Taxonomy | undefined {
  return list.find((t) => t.slug === slug);
}

// --- internals -----------------------------------------------------------

function groupBy(posts: BlogPost[], pick: (post: BlogPost) => string[]): Taxonomy[] {
  const slugger = new GithubSlugger();
  const slugOf = new Map<string, string>();
  const bySlug = new Map<string, Taxonomy>();
  for (const post of posts) {
    for (const name of pick(post)) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      let slug = slugOf.get(trimmed.toLowerCase());
      if (slug === undefined) {
        slug = slugger.slug(trimmed);
        slugOf.set(trimmed.toLowerCase(), slug);
      }
      const existing = bySlug.get(slug);
      if (existing) existing.posts.push(post);
      else bySlug.set(slug, { name: trimmed, slug, posts: [post] });
    }
  }
  return [...bySlug.values()].sort(
    (a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name),
  );
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string')
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}
