/**
 * md-book core — environment-agnostic Markdown rendering and content model.
 *
 * The runtime (browser) and future SSG layers build on top of these pure
 * functions; nothing exported here touches the DOM or the filesystem.
 */

export {
  BLOG_DEFAULTS,
  type BlogRuntimeConfig,
  type BlogView,
  type HrefSource,
  localizeBlogConfig,
  resolveBlogView,
} from './core/blog-views.js';
export {
  collectPosts,
  findTaxonomy,
  groupByCategory,
  groupByTag,
  paginate,
  toDate,
} from './core/blog.js';
export type { BlogOptions, BlogPost, Paginated, Taxonomy } from './core/blog.js';
export {
  assertManifest,
  buildNav,
  buildSidebar,
  entryTitle,
  fileToRoutePath,
  flattenPages,
  getPrevNext,
  makeEntry,
  MANIFEST_VERSION,
  orderFromFilename,
  resolveRoutes,
  stripManifestBase,
} from './core/content.js';
export { type HrefResolver, renderHome } from './core/home.js';
export { type FeedFormat, type FeedOptions, generateFeed } from './core/feed.js';
export {
  createStrings,
  DEFAULT_LOCALE,
  getStrings,
  type Locale,
  resolveLocale,
  SUPPORTED_LOCALES,
  type UIStrings,
} from './core/i18n.js';
export {
  type LocaleAlternate,
  type LocaleConfig,
  type LocaleSetup,
  alternatesOf,
  entriesForLocale,
  localeOfRoute,
  localePrefix,
  localeSite,
  localizeRoute,
  normalizeLocales,
  stripLocale,
} from './core/locale.js';
export {
  type ExtractOptions,
  type SearchDoc,
  type SearchIndex,
  type SearchOptions,
  type SearchResult,
  type Searcher,
  SEARCH_INDEX_VERSION,
  assertSearchIndex,
  createSearchIndex,
  createSearcher,
  extractSearchDoc,
  htmlToText,
} from './core/search.js';
export {
  type HeadAlternate,
  type HeadContext,
  type HeadData,
  type HeadInput,
  type HeadTag,
  type SeoConfig,
  buildHead,
  headToHTML,
} from './core/head.js';
export type { MathRenderer } from './core/markdown/plugins/math.js';
export type {
  Manifest,
  ManifestEntry,
  NavItem,
  NavOptions,
  PrevNext,
  RouteNode,
  SidebarOptions,
} from './core/content.js';
export { createMarkdown } from './core/markdown/index.js';
export type { MarkdownConfig } from './core/markdown/index.js';
export { highlightCode } from './core/markdown/highlight.js';
export { buildToc } from './core/markdown/plugins/anchor-toc.js';
export { DEFAULT_CONTAINER_TYPES } from './core/markdown/plugins/containers.js';
export { renderMarkdown } from './core/render.js';
export type {
  FrontMatter,
  HomeAction,
  HomeFeature,
  HomeHero,
  RenderOptions,
  RenderResult,
  TocEntry,
} from './core/types.js';
export { DEFAULT_THEME_STORAGE_KEY, themeInitScript } from './core/theme-script.js';
export { version } from './version.js';
