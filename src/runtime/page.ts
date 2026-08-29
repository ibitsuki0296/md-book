import type { Manifest, ManifestEntry } from '../core/content.js';
import { renderMarkdown } from '../core/render.js';
import type { RenderResult } from '../core/types.js';

export interface LoadedPage extends RenderResult {
  entry: ManifestEntry;
  path: string;
}

export interface PageLoaderOptions {
  manifest: Manifest;
  /** Absolute URL the manifest was fetched from; used to resolve relative `file` paths. */
  manifestUrl?: string;
  tocDepth?: [number, number];
  /** Override how a raw Markdown file is fetched (tests, custom transports). */
  fetchText?: (url: string) => Promise<string>;
}

/** Fetches and renders Markdown pages, caching results by route path. */
export class PageLoader {
  private readonly manifest: Manifest;
  private readonly byPath = new Map<string, ManifestEntry>();
  private readonly cache = new Map<string, LoadedPage>();
  private readonly inflight = new Map<string, Promise<LoadedPage>>();
  private readonly base: string;
  private readonly tocDepth?: [number, number];
  private readonly contentRoot: string;
  private readonly fetchText: (url: string) => Promise<string>;

  constructor(options: PageLoaderOptions) {
    this.manifest = options.manifest;
    this.base = options.manifest.base || '/';
    this.tocDepth = options.tocDepth;
    this.fetchText = options.fetchText ?? defaultFetchText;
    this.contentRoot = resolveContentRoot(options.manifest, options.manifestUrl);
    for (const entry of options.manifest.entries) this.byPath.set(entry.path, entry);
  }

  has(path: string): boolean {
    return this.byPath.has(path);
  }

  get entries(): ManifestEntry[] {
    return this.manifest.entries;
  }

  entry(path: string): ManifestEntry | undefined {
    return this.byPath.get(path);
  }

  /** Absolute URL of the raw Markdown file backing a route. */
  fileUrl(entry: ManifestEntry): string {
    return new URL(entry.file, this.contentRoot).toString();
  }

  async load(path: string): Promise<LoadedPage> {
    const cached = this.cache.get(path);
    if (cached) return cached;
    const existing = this.inflight.get(path);
    if (existing) return existing;

    const entry = this.byPath.get(path);
    if (!entry) throw new PageNotFoundError(path);

    const promise = this.fetchText(this.fileUrl(entry))
      .then((text) => {
        const rendered = renderMarkdown(text, {
          tocDepth: this.tocDepth,
          linkRewrite: { currentPath: path, base: this.base },
        });
        const page: LoadedPage = { ...rendered, entry, path };
        this.cache.set(path, page);
        this.inflight.delete(path);
        return page;
      })
      .catch((err) => {
        this.inflight.delete(path);
        throw err;
      });

    this.inflight.set(path, promise);
    return promise;
  }

  /** Best-effort background load; errors are swallowed. */
  prefetch(path: string): void {
    if (this.cache.has(path) || this.inflight.has(path) || !this.byPath.has(path)) return;
    void this.load(path).catch(() => undefined);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export class PageNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`md-book: no page for route "${path}"`);
    this.name = 'PageNotFoundError';
  }
}

function defaultFetchText(url: string): Promise<string> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`md-book: failed to fetch ${url} (${res.status})`);
    return res.text();
  });
}

function resolveContentRoot(manifest: Manifest, manifestUrl?: string): string {
  const docBase =
    typeof document !== 'undefined' && document.baseURI ? document.baseURI : 'http://localhost/';
  if (manifest.contentBase) {
    const root = manifest.contentBase.endsWith('/')
      ? manifest.contentBase
      : `${manifest.contentBase}/`;
    return new URL(root, docBase).toString();
  }
  if (manifestUrl) {
    // Files are resolved relative to the directory the manifest lives in.
    return new URL('./', new URL(manifestUrl, docBase)).toString();
  }
  return docBase;
}
