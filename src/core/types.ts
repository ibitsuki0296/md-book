/**
 * Shared, environment-agnostic types for md-book.
 * Nothing in this file may import DOM or Node APIs.
 */

/** Raw front matter as parsed from a page's YAML block. */
export interface FrontMatter {
  title?: string;
  description?: string;
  /** ISO date string or anything `Date` can parse. Blog ordering key. */
  date?: string;
  updated?: string;
  tags?: string[];
  categories?: string[];
  draft?: boolean;
  /** Sidebar sort key within a directory (lower = earlier). */
  order?: number;
  /** Overrides the slug derived from the file path. */
  slug?: string;
  cover?: string;
  author?: string;
  /** Named layout hint consumed by the runtime/SSG layer. */
  layout?: string;
  [key: string]: unknown;
}

/** One heading extracted from rendered content, for building a table of contents. */
export interface TocEntry {
  /** Heading level (1-6). */
  level: number;
  /** Slugified id assigned to the heading element. */
  id: string;
  /** Plain-text heading content. */
  text: string;
  children: TocEntry[];
}

export interface RenderOptions {
  /**
   * Allow raw HTML embedded in the Markdown source to pass through.
   * Off by default; when on, callers are responsible for sanitizing output.
   */
  allowHtml?: boolean;
  /** Inclusive heading-level range collected into the TOC. Default `[2, 3]`. */
  tocDepth?: [number, number];
  /** Enable `:::note` / `:::warning` style container blocks. Default `true`. */
  containers?: boolean;
  /** Enable footnotes. Default `true`. */
  footnotes?: boolean;
  /**
   * Rewrites links so that `./foo.md` and `../bar/baz.md` become route paths.
   * `currentPath` is the route path of the page being rendered (e.g. `/guide/intro`).
   */
  linkRewrite?:
    | false
    | {
        currentPath: string;
        /** Site base path, e.g. `/docs/`. Default `/`. */
        base?: string;
      };
  /** Characters of the first paragraph to keep as `excerpt`. Default 200. */
  excerptLength?: number;
}

export interface RenderResult {
  /** Rendered HTML fragment (no wrapping document). */
  html: string;
  /** Parsed front matter (empty object when absent). */
  frontMatter: FrontMatter;
  /** Nested table of contents built from headings in range. */
  toc: TocEntry[];
  /** Flat list of every heading found (all levels). */
  headings: TocEntry[];
  /** Plain-text summary taken from the first paragraph. */
  excerpt: string;
}
