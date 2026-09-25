/**
 * Shared, environment-agnostic types for md-book.
 * Nothing in this file may import DOM or Node APIs.
 */

/** A call-to-action button in the home-page hero. */
export interface HomeAction {
  text: string;
  /** Route path (`/guide/intro`), `#hash`, or an absolute URL. */
  link: string;
  /** `brand` (filled, default for the first action) or `alt` (outlined). */
  theme?: 'brand' | 'alt';
}

/** Hero block for `layout: home` pages. */
export interface HomeHero {
  /** Small eyebrow / product name, rendered as the page's `<h1>`. */
  name?: string;
  /** Large headline. */
  text?: string;
  tagline?: string;
  actions?: HomeAction[];
}

/** One feature card on a `layout: home` page. */
export interface HomeFeature {
  title: string;
  details?: string;
  /** Short glyph or emoji shown in the card's badge. */
  icon?: string;
  /** Makes the whole card a link. */
  link?: string;
}

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
  /** Named layout hint consumed by the runtime/SSG layer. `home` enables `hero` / `features`. */
  layout?: string;
  /** `vertical` renders the page in vertical writing mode (縦書き, e.g. for tanka). Default horizontal. */
  writing?: 'horizontal' | 'vertical';
  /** Hero block, used when `layout: home`. */
  hero?: HomeHero;
  /** Feature cards, used when `layout: home`. */
  features?: HomeFeature[];
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
  /** Enable `{漢字|かんじ}` ruby annotations. Default `true`. */
  ruby?: boolean;
  /** Enable footnotes. Default `true`. */
  footnotes?: boolean;
  /**
   * Built-in syntax highlighting for fenced code (js/ts, json, css, html, sh,
   * yaml, python, diff). Default `true`. Unknown languages stay plain.
   */
  highlight?: boolean;
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
