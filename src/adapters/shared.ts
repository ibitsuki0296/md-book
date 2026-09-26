import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { generateManifest } from '../cli/manifest.js';
import { generateSearchIndex } from '../cli/search.js';
import type { Manifest } from '../core/content.js';
import type { LocaleConfig } from '../core/locale.js';

/** Options shared by the Vite, Astro and Next adapters. */
export interface MdBookAdapterOptions {
  /** Directory of Markdown sources, relative to the project root. Default `content`. */
  contentDir?: string;
  /** Site title / description stored in the manifest. */
  title?: string;
  description?: string;
  /** Content-level i18n (see `md-book manifest --locales`). */
  locales?: ReadonlyArray<string | LocaleConfig>;
  defaultLocale?: string;
  /** Also write `search-index.json` for the search box. Default `true`. */
  search?: boolean;
  /** Include `draft: true` pages (dev servers always do). Default `false`. */
  drafts?: boolean;
  /**
   * Deployment base path. The adapters read it from the host framework
   * (Vite `base`, Astro `base`, Next `basePath`); set it here to override.
   */
  base?: string;
}

/** URL directory (relative to the base) the raw Markdown is served from. */
export const CONTENT_URL_DIR = 'md-book-content';

export function normalizeBase(base: string | undefined): string {
  if (!base || base === '/' || base === './' || base === '.') return '/';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

export interface SiteAssets {
  manifest: Manifest;
  /** Generated files, keyed by path relative to the site root (`manifest.json`, …). */
  files: Map<string, string | Buffer>;
}

/**
 * Builds the files the runtime needs next to a page: `manifest.json`,
 * `search-index.json` and the raw Markdown under `md-book-content/`. Routes are
 * base-relative; `manifest.base` carries the deployment base.
 */
export function collectSiteAssets(
  options: MdBookAdapterOptions,
  root: string,
  base: string,
  mode: 'dev' | 'build',
): SiteAssets {
  const contentDir = resolve(root, options.contentDir ?? 'content');
  const drafts = mode === 'dev' || options.drafts === true;
  const manifest: Manifest = {
    ...generateManifest({
      contentDir,
      base: '/',
      includeDrafts: drafts,
      locales: options.locales,
      defaultLocale: options.defaultLocale,
      title: options.title,
      description: options.description,
      contentBase: `${base === '/' ? '' : base}/${CONTENT_URL_DIR}`,
    }),
    base,
  };

  const files = new Map<string, string | Buffer>();
  files.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  if (options.search !== false) {
    const index = generateSearchIndex({
      contentDir,
      includeDrafts: drafts,
      locales: options.locales,
      defaultLocale: options.defaultLocale,
    });
    files.set('search-index.json', `${JSON.stringify(index)}\n`);
  }
  for (const entry of manifest.entries) {
    files.set(`${CONTENT_URL_DIR}/${entry.file}`, readFileSync(join(contentDir, entry.file)));
  }
  return { manifest, files };
}

/** Writes assets under `outDir`, refusing paths that escape it. */
export function writeAssets(outDir: string, files: Map<string, string | Buffer>): void {
  const root = resolve(outDir);
  for (const [rel, data] of files) {
    const target = resolve(root, rel);
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`md-book: refusing to write outside ${root}: ${rel}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
}

export const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
};

/** Content type for a generated file path. */
export function mimeFor(path: string): string {
  const dot = path.lastIndexOf('.');
  return MIME[dot === -1 ? '' : path.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

/** Debounced recursive watcher; returns a disposer. Silently a no-op where unsupported. */
export function watchContent(dir: string, onChange: () => void): () => void {
  if (!existsSync(dir)) return () => undefined;
  let timer: NodeJS.Timeout | undefined;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 80);
  };
  try {
    const watcher = watch(dir, { recursive: true }, fire);
    return () => watcher.close();
  } catch {
    try {
      const watcher = watch(dir, fire);
      return () => watcher.close();
    } catch {
      return () => undefined;
    }
  }
}

export interface NodeReq {
  url?: string;
}
export interface NodeRes {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(chunk?: string | Uint8Array): unknown;
}

/** Connect-style middleware serving the generated assets (dev servers). */
export function createAssetMiddleware(
  getAssets: () => SiteAssets,
  getBase: () => string,
): (req: NodeReq, res: NodeRes, next: () => void) => void {
  return (req, res, next) => {
    const base = getBase();
    const pathname = (req.url ?? '/').split('?')[0] ?? '/';
    const prefix = base === '/' ? '/' : `${base}/`;
    // Some dev servers hand middleware the URL with the base already stripped
    // (Astro, Vite once its base middleware has run), others the full URL.
    const local = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1);
    let rel: string;
    try {
      rel = decodeURIComponent(local);
    } catch {
      return next();
    }
    const body = getAssets().files.get(rel);
    if (body === undefined) return next();
    res.statusCode = 200;
    res.setHeader('content-type', mimeFor(rel));
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  };
}
