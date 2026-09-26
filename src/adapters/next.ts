/**
 * Next.js adapter: generates the runtime's `manifest.json`, `search-index.json`
 * and raw Markdown into `public/` when Next loads its config — and keeps them
 * fresh while `next dev` runs.
 *
 *   // next.config.mjs
 *   import { withMdBook } from '@ibitsuki0296/md-book/next';
 *   export default withMdBook({ contentDir: 'content' })(nextConfig);
 *
 * `basePath` is picked up automatically. Mount the site from a client
 * component (`<md-book manifest="/manifest.json" />` after importing
 * `@ibitsuki0296/md-book/runtime`). Types are structural, so `next` is not a
 * dependency of md-book.
 */
import { resolve } from 'node:path';
import {
  type MdBookAdapterOptions,
  collectSiteAssets,
  normalizeBase,
  watchContent,
  writeAssets,
} from './shared.js';

export type { MdBookAdapterOptions };

export interface WithMdBookOptions extends MdBookAdapterOptions {
  /** Where the generated files go. Default `public` (add them to `.gitignore`). */
  publicDir?: string;
}

const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';

type NextConfigLike = { basePath?: string; [key: string]: unknown };
type NextConfigInput =
  | NextConfigLike
  | ((
      phase: string,
      context: { defaultConfig: NextConfigLike },
    ) => NextConfigLike | Promise<NextConfigLike>);

/** Wraps a Next.js config (object or function) so md-book's site files are generated for it. */
export function withMdBook(options: WithMdBookOptions = {}) {
  return (nextConfig: NextConfigInput = {}) =>
    async (phase: string, context: { defaultConfig: NextConfigLike }): Promise<NextConfigLike> => {
      const resolved =
        typeof nextConfig === 'function' ? await nextConfig(phase, context) : nextConfig;
      const root = process.cwd();
      const base = normalizeBase(options.base ?? resolved.basePath);
      const out = resolve(root, options.publicDir ?? 'public');
      const dev = phase === PHASE_DEVELOPMENT_SERVER;

      const generate = () =>
        writeAssets(out, collectSiteAssets(options, root, base, dev ? 'dev' : 'build').files);
      generate();
      if (dev) {
        const stop = watchContent(resolve(root, options.contentDir ?? 'content'), generate);
        process.once('exit', stop);
      }
      return resolved;
    };
}

export default withMdBook;
