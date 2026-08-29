/**
 * md-book core — environment-agnostic Markdown rendering and content model.
 *
 * The runtime (browser) and future SSG layers build on top of these pure
 * functions; nothing exported here touches the DOM or the filesystem.
 */

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

export const version = '0.0.0';
