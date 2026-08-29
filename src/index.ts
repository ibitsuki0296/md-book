/**
 * md-book core — environment-agnostic Markdown rendering and content model.
 *
 * The runtime (browser) and future SSG layers build on top of these pure
 * functions; nothing exported here touches the DOM or the filesystem.
 */

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
} from './core/content.js';
export { type FeedFormat, type FeedOptions, generateFeed } from './core/feed.js';
export type {
  Manifest,
  ManifestEntry,
  NavItem,
  PrevNext,
  RouteNode,
  SidebarOptions,
} from './core/content.js';
export { createMarkdown } from './core/markdown/index.js';
export type { MarkdownConfig } from './core/markdown/index.js';
export { buildToc } from './core/markdown/plugins/anchor-toc.js';
export { DEFAULT_CONTAINER_TYPES } from './core/markdown/plugins/containers.js';
export { renderMarkdown } from './core/render.js';
export type {
  FrontMatter,
  RenderOptions,
  RenderResult,
  TocEntry,
} from './core/types.js';
export { version } from './version.js';
