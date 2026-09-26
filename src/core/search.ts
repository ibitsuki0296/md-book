/**
 * Client-side full-text search: a build-time index of plain text per page and a
 * tiny query engine that runs over it in the browser.
 *
 * Deliberately not an inverted index. Documentation sites are small (hundreds of
 * pages), and a normalised substring scan is fast enough there, ships no
 * dependency, and — unlike word-based tokenisers — works for Japanese / Chinese
 * text that has no spaces. Pure and DOM-free (`core` rules).
 */
import { renderMarkdown } from './render.js';
import type { FrontMatter, RenderOptions } from './types.js';

/** Bump on breaking changes to the {@link SearchIndex} shape. */
export const SEARCH_INDEX_VERSION = 1 as const;

export interface SearchDoc {
  /** Route path, e.g. `/guide/intro`. */
  path: string;
  title: string;
  /** Section headings, in document order. */
  headings: string[];
  /** Body plain text, NFKC-normalised and whitespace-collapsed (possibly truncated). */
  text: string;
  /** Locale of the page, when the site is localised. */
  locale?: string;
}

export interface SearchIndex {
  version: typeof SEARCH_INDEX_VERSION;
  docs: SearchDoc[];
}

export interface SearchResult {
  path: string;
  title: string;
  /** The heading the match falls under, when the match is in a section title. */
  heading?: string;
  score: number;
  /** A short plain-text excerpt around the first body match. */
  snippet: string;
  /** `[start, end)` offsets into `snippet` for the matched terms. */
  ranges: Array<[number, number]>;
}

export interface SearchOptions {
  /** Maximum results. Default 10. */
  limit?: number;
  /** Only search pages of this locale. */
  locale?: string;
  /** Snippet length in characters. Default 140. */
  snippetLength?: number;
}

export interface Searcher {
  search(query: string, options?: SearchOptions): SearchResult[];
}

export interface ExtractOptions {
  /** Cap on body characters kept per page (`0` = unlimited). Default 8000. */
  maxChars?: number;
  render?: Pick<RenderOptions, 'math' | 'mermaid' | 'ruby' | 'containers' | 'footnotes'>;
}

/**
 * Builds one {@link SearchDoc} from a Markdown source. `title` is the fallback
 * when the page has no front-matter title.
 */
export function extractSearchDoc(
  source: string,
  meta: { path: string; title: string; locale?: string },
  options: ExtractOptions = {},
): SearchDoc {
  const rendered = renderMarkdown(source, {
    ...options.render,
    highlight: false,
    linkRewrite: false,
  });
  const fm = rendered.frontMatter;
  const title = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : meta.title;

  const parts = [str(fm.description), ...homeText(fm), htmlToText(rendered.html)].filter(Boolean);
  let text = normalize(parts.join(' '));
  const max = options.maxChars ?? 8000;
  if (max > 0 && text.length > max) text = text.slice(0, max);

  const doc: SearchDoc = {
    path: meta.path,
    title,
    headings: rendered.headings.map((h) => normalize(h.text)).filter(Boolean),
    text,
  };
  if (meta.locale) doc.locale = meta.locale;
  return doc;
}

export function createSearchIndex(docs: SearchDoc[]): SearchIndex {
  return { version: SEARCH_INDEX_VERSION, docs };
}

export function assertSearchIndex(value: unknown): asserts value is SearchIndex {
  const v = value as Partial<SearchIndex> | null;
  if (!v || typeof v !== 'object' || v.version !== SEARCH_INDEX_VERSION || !Array.isArray(v.docs)) {
    throw new Error('md-book: invalid search index');
  }
}

/** Creates a query engine over an index. Queries are AND-ed, whitespace-separated terms. */
export function createSearcher(index: SearchIndex): Searcher {
  const prepared = index.docs.map((doc) => ({
    doc,
    title: fold(normalize(doc.title)),
    headings: doc.headings.map(fold),
    text: fold(doc.text),
  }));

  return {
    search(query, options = {}) {
      const terms = [...new Set(fold(normalize(query)).split(' ').filter(Boolean))];
      if (terms.length === 0) return [];
      const limit = options.limit ?? 10;
      const snippetLength = options.snippetLength ?? 140;

      const scored: Array<SearchResult & { order: number }> = [];
      prepared.forEach((entry, order) => {
        if (options.locale && entry.doc.locale && entry.doc.locale !== options.locale) return;

        let score = 0;
        let heading: string | undefined;
        let firstBody = -1;
        for (const term of terms) {
          let hit = false;
          const inTitle = entry.title.indexOf(term);
          if (inTitle !== -1) {
            score += inTitle === 0 ? 14 : 10;
            hit = true;
          }
          const h = entry.headings.findIndex((x) => x.includes(term));
          if (h !== -1) {
            score += 5;
            heading ??= entry.doc.headings[h];
            hit = true;
          }
          const count = countOccurrences(entry.text, term, 5);
          if (count > 0) {
            score += count;
            const at = entry.text.indexOf(term);
            if (firstBody === -1 || at < firstBody) firstBody = at;
            hit = true;
          }
          if (!hit) return; // every term must match somewhere
        }
        const { snippet, ranges } = makeSnippet(
          entry.doc,
          entry.text,
          terms,
          firstBody,
          snippetLength,
        );
        scored.push({
          path: entry.doc.path,
          title: entry.doc.title,
          heading,
          score,
          snippet,
          ranges,
          order,
        });
      });

      scored.sort((a, b) => b.score - a.score || a.order - b.order);
      return scored.slice(0, limit).map(({ order: _order, ...result }) => result);
    },
  };
}

// --- text helpers ---------------------------------------------------------

/** NFKC-normalises (full-width → half-width, etc.) and collapses whitespace. */
export function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Case-folds one code unit at a time so offsets into the folded string stay valid. */
function fold(value: string): string {
  let out = '';
  for (const ch of value) {
    const lower = ch.toLowerCase();
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

function countOccurrences(haystack: string, needle: string, cap: number): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1 && count < cap) {
    count++;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

function makeSnippet(
  doc: SearchDoc,
  foldedText: string,
  terms: string[],
  firstBody: number,
  length: number,
): { snippet: string; ranges: Array<[number, number]> } {
  // Fall back to the start of the page when the match is only in the title / headings.
  const source = doc.text;
  const centre = firstBody === -1 ? 0 : firstBody;
  let start = Math.max(0, centre - Math.floor(length / 4));
  let end = Math.min(source.length, start + length);
  start = Math.max(0, Math.min(start, end - length));
  if (start > 0) {
    // Begin on a word boundary when the text has any.
    const space = source.indexOf(' ', start);
    if (space !== -1 && space < centre) start = space + 1;
  }
  end = Math.min(source.length, start + length);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  const snippet = `${prefix}${source.slice(start, end)}${suffix}`;

  const region = foldedText.slice(start, end);
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let at = region.indexOf(term);
    while (at !== -1) {
      ranges.push([prefix.length + at, prefix.length + at + term.length]);
      at = region.indexOf(term, at + term.length);
    }
  }
  return { snippet, ranges: mergeRanges(ranges) };
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else out.push([range[0], range[1]]);
  }
  return out;
}

const BLOCK_TAG =
  /<\/?(?:p|div|h[1-6]|li|ul|ol|pre|br|hr|tr|td|th|table|thead|tbody|blockquote|section|article|aside|header|footer|figure|figcaption|dl|dt|dd|details|summary)\b[^>]*>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Visible text of an HTML fragment (block boundaries become spaces; ruby readings dropped). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<r[pt]>[\s\S]*?<\/r[pt]>/gi, '')
    .replace(/<a class="md-book-anchor"[^>]*>[\s\S]*?<\/a>/g, '') // heading permalinks
    .replace(BLOCK_TAG, ' ') // block boundaries separate words…
    .replace(/<[^>]*>/g, '') // …inline tags do not ("CSS</a>." stays "CSS.")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code.startsWith('#x')) return safeChar(Number.parseInt(code.slice(2), 16), whole);
      if (code.startsWith('#')) return safeChar(Number.parseInt(code.slice(1), 10), whole);
      return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
    });
}

function safeChar(codePoint: number, fallback: string): string {
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

/** Text that only exists in front matter for `layout: home` pages. */
function homeText(fm: FrontMatter): string[] {
  const out: string[] = [];
  const hero = fm.hero;
  if (hero && typeof hero === 'object') {
    out.push(str(hero.name), str(hero.text), str(hero.tagline));
  }
  if (Array.isArray(fm.features)) {
    for (const f of fm.features) {
      if (f && typeof f === 'object') out.push(str(f.title), str(f.details));
    }
  }
  return out.filter(Boolean);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
