/**
 * md-book Node API — the programmatic side of the CLI: manifest / search-index /
 * feed generation, static site builds and the dev server. Node only.
 */
export { type BuildSiteOptions, type BuildSiteResult, buildSite } from './cli/build.js';
export { type DevServer, type DevServerOptions, startDevServer } from './cli/dev.js';
export { type WriteFeedOptions, writeFeeds } from './cli/feed.js';
export {
  type GenerateManifestOptions,
  generateManifest,
  writeManifest,
} from './cli/manifest.js';
export {
  type GenerateSearchIndexOptions,
  generateSearchIndex,
  writeSearchIndex,
} from './cli/search.js';
export { type SiteRenderInput, type SitePage, renderSite, routeToFile } from './core/site.js';
export { type SitemapEntry, generateSitemap } from './core/sitemap.js';
