/**
 * Vite plugin: generates the runtime's `manifest.json`, `search-index.json` and
 * raw Markdown for a content directory — served live (with reload on edit) by
 * the dev server, emitted as assets by `vite build` — and exposes the manifest
 * as `virtual:md-book/manifest`.
 *
 *   // vite.config.ts
 *   import { mdBook } from '@ibitsuki0296/md-book/vite';
 *   export default defineConfig({ plugins: [mdBook({ contentDir: 'content' })] });
 *
 * Types are structural on purpose, so `vite` is not a dependency of md-book.
 */
import { resolve } from 'node:path';
import {
  type MdBookAdapterOptions,
  type SiteAssets,
  collectSiteAssets,
  createAssetMiddleware,
  normalizeBase,
  watchContent,
} from './shared.js';

export type { MdBookAdapterOptions };

export const VIRTUAL_MANIFEST_ID = 'virtual:md-book/manifest';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_MANIFEST_ID}`;

interface ViteConfigLike {
  root: string;
  base: string;
}

interface ViteDevServerLike {
  // Connect's `use` is heavily overloaded, which no narrow structural type can match.
  // biome-ignore lint/suspicious/noExplicitAny: see above
  middlewares: { use(...args: any[]): unknown };
  // biome-ignore lint/suspicious/noExplicitAny: Node's `on` is overloaded per event
  httpServer?: { on(...args: any[]): unknown } | null;
  watcher?: { add(path: string): unknown };
  ws: { send(payload: { type: 'full-reload'; path?: string }): void };
  moduleGraph?: {
    getModuleById(id: string): unknown;
    invalidateModule(mod: never): void;
  };
}

/** The structural subset of Vite's `Plugin` this plugin implements. */
export interface MdBookVitePlugin {
  name: string;
  configResolved(config: ViteConfigLike): void;
  configureServer(server: ViteDevServerLike): void;
  resolveId(id: string): string | undefined;
  load(id: string): string | undefined;
  generateBundle(this: {
    emitFile(file: { type: 'asset'; fileName: string; source: string | Uint8Array }): string;
  }): void;
  buildEnd?: () => void;
}

export function mdBook(options: MdBookAdapterOptions = {}): MdBookVitePlugin {
  let root = process.cwd();
  let base = normalizeBase(options.base);
  let assets: SiteAssets | null = null;
  const build = (mode: 'dev' | 'build') => collectSiteAssets(options, root, base, mode);

  return {
    name: 'md-book',

    configResolved(config) {
      root = config.root;
      base = normalizeBase(options.base ?? config.base);
    },

    configureServer(server) {
      const contentDir = resolve(root, options.contentDir ?? 'content');
      server.watcher?.add(contentDir);
      const invalidate = () => {
        assets = null;
        const mod = server.moduleGraph?.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) server.moduleGraph?.invalidateModule(mod as never);
        server.ws.send({ type: 'full-reload' });
      };
      const stop = watchContent(contentDir, invalidate);
      server.httpServer?.on('close', stop);
      server.middlewares.use(
        createAssetMiddleware(
          () => {
            assets ??= build('dev');
            return assets;
          },
          () => base,
        ),
      );
    },

    resolveId(id) {
      return id === VIRTUAL_MANIFEST_ID ? RESOLVED_VIRTUAL_ID : undefined;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined;
      assets ??= build('build');
      return `export default ${JSON.stringify(assets.manifest)};`;
    },

    generateBundle() {
      const built = build('build');
      for (const [fileName, source] of built.files) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}

export default mdBook;
