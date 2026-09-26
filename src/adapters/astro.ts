/**
 * Astro integration: serves the runtime's `manifest.json`, `search-index.json`
 * and raw Markdown from the dev server (reloading on edit) and writes them into
 * the build output.
 *
 *   // astro.config.mjs
 *   import { mdBook } from '@ibitsuki0296/md-book/astro';
 *   export default defineConfig({ integrations: [mdBook({ contentDir: 'content' })] });
 *
 * then mount the site from any page with `<md-book manifest="/manifest.json">`
 * (or `mount()`), plus `import '@ibitsuki0296/md-book/style.css'`.
 * Types are structural, so `astro` is not a dependency of md-book.
 */
import { fileURLToPath } from 'node:url';
import {
  type MdBookAdapterOptions,
  type SiteAssets,
  collectSiteAssets,
  createAssetMiddleware,
  normalizeBase,
  watchContent,
  writeAssets,
} from './shared.js';

export type { MdBookAdapterOptions };

interface AstroConfigLike {
  root: URL;
  base: string;
}

interface AstroServerLike {
  // biome-ignore lint/suspicious/noExplicitAny: Connect's overloaded `use` cannot be matched structurally
  middlewares: { use(...args: any[]): unknown };
  // biome-ignore lint/suspicious/noExplicitAny: Node's `on` is overloaded per event
  httpServer?: { on(...args: any[]): unknown } | null;
  ws?: { send(payload: { type: 'full-reload' }): void };
}

/** The structural subset of Astro's `AstroIntegration` this integration implements. */
export interface MdBookAstroIntegration {
  name: string;
  hooks: {
    'astro:config:setup': (params: { config: AstroConfigLike }) => void;
    'astro:server:setup': (params: { server: AstroServerLike }) => void;
    'astro:build:done': (params: { dir: URL }) => void;
  };
}

export function mdBook(options: MdBookAdapterOptions = {}): MdBookAstroIntegration {
  let root = process.cwd();
  let base = normalizeBase(options.base);
  let assets: SiteAssets | null = null;

  return {
    name: 'md-book',
    hooks: {
      'astro:config:setup': ({ config }) => {
        root = fileURLToPath(config.root);
        base = normalizeBase(options.base ?? config.base);
      },
      'astro:server:setup': ({ server }) => {
        const contentDir = `${root.replace(/\/$/, '')}/${options.contentDir ?? 'content'}`;
        const stop = watchContent(contentDir, () => {
          assets = null;
          server.ws?.send({ type: 'full-reload' });
        });
        server.httpServer?.on('close', stop);
        server.middlewares.use(
          createAssetMiddleware(
            () => {
              assets ??= collectSiteAssets(options, root, base, 'dev');
              return assets;
            },
            () => base,
          ),
        );
      },
      'astro:build:done': ({ dir }) => {
        writeAssets(fileURLToPath(dir), collectSiteAssets(options, root, base, 'build').files);
      },
    },
  };
}

export default mdBook;
