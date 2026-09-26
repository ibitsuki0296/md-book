import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BlogRuntimeConfig } from '../core/blog-views.js';
import { toDate } from '../core/blog.js';
import type { Manifest, ManifestEntry } from '../core/content.js';
import { absoluteUrl } from '../core/head.js';
import type { LocaleConfig } from '../core/locale.js';
import type { MathRenderer } from '../core/markdown/plugins/math.js';
import { createSiteModel } from '../core/site-model.js';
import { renderSite } from '../core/site.js';
import { generateSitemap } from '../core/sitemap.js';
import { writeFeeds } from './feed.js';
import { generateManifest } from './manifest.js';
import { generateSearchIndex } from './search.js';

export interface BuildSiteOptions {
  /** Directory of Markdown sources. */
  contentDir: string;
  /** Where the static site is written. Must not be inside `contentDir`. */
  outDir: string;
  /** Deployment base path, e.g. `/docs/` for GitHub project pages. Default `/`. */
  base?: string;
  /**
   * Absolute URL of the deployed site **including the base** (`https://example.com/docs/`).
   * Enables canonical / Open Graph URLs, `sitemap.xml` and blog feeds.
   */
  siteUrl?: string;
  title?: string;
  description?: string;
  /** UI language for a non-localised site (`en` / `ja`). */
  locale?: string;
  /** Content-level i18n; see `md-book manifest --locales`. */
  locales?: ReadonlyArray<string | LocaleConfig>;
  defaultLocale?: string;
  /** Blog routes (list / pagination / tags / categories) and feeds. */
  blog?: boolean | Partial<BlogRuntimeConfig>;
  /** Write `search-index.json` and turn the search box on. Default `false`. */
  search?: boolean;
  /** Enable `$…$` math. Pre-rendered with KaTeX when it is installed in the project. */
  math?: boolean;
  /** Override the build-time math renderer (skips the `katex` lookup). */
  mathRenderer?: MathRenderer;
  /** Enable ```mermaid diagrams (drawn in the browser). */
  mermaid?: boolean;
  /** Extra HTML injected into every page's `<head>`. */
  headHTML?: string;
  /** Default theme mode written to `<md-book theme>`: `light` | `dark` | `system`. */
  theme?: string;
  /** Default feed author. */
  author?: string;
  /** Include `draft: true` pages. Default `false`. */
  drafts?: boolean;
  /**
   * Ship the runtime (`md-book.global.js`, manifest, raw Markdown) so the
   * pre-rendered pages become the interactive app. `false` writes plain static
   * HTML + CSS only. Default `true`.
   */
  runtime?: boolean;
  /** Directory holding `md-book.global.js` / `style.css`. Default: this package's `dist/`. */
  distDir?: string;
}

export interface BuildSiteResult {
  pages: number;
  /** Every file written, relative to `outDir`. */
  files: string[];
}

const CONTENT_DIR_NAME = 'md-book-content';
const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css';

/** Builds a fully static site: pre-rendered HTML for every route, plus the runtime that hydrates it. */
export async function buildSite(options: BuildSiteOptions): Promise<BuildSiteResult> {
  const contentDir = resolve(options.contentDir);
  const outDir = resolve(options.outDir);
  assertOutDir(contentDir, outDir);

  const base = normalizeBase(options.base ?? '/');
  const runtime = options.runtime !== false;
  const files: string[] = [];
  const write = (rel: string, data: string | Buffer) => {
    const target = resolve(outDir, rel);
    if (!isInside(outDir, target)) {
      throw new Error(`md-book: refusing to write outside ${outDir}: ${rel}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    files.push(rel.split(sep).join('/'));
  };

  // Routes are base-relative (what the runtime router reports); `base` only prefixes URLs.
  const manifest: Manifest = {
    ...generateManifest({
      contentDir,
      base: '/',
      includeDrafts: options.drafts,
      locales: options.locales,
      defaultLocale: options.defaultLocale,
      title: options.title,
      description: options.description,
      contentBase: `${base === '/' ? '' : base}/${CONTENT_DIR_NAME}`,
    }),
    base,
  };

  let mathRenderer = options.mathRenderer;
  if (options.math && !mathRenderer) mathRenderer = (await loadKatexRenderer()) ?? undefined;

  const render = {
    math: options.math ? (mathRenderer ? { render: mathRenderer } : true) : undefined,
    mermaid: options.mermaid,
  };
  const headHTML = [
    options.math ? `<link rel="stylesheet" href="${KATEX_CSS}" data-md-book-katex>` : '',
    options.headHTML ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const pages = renderSite({
    manifest,
    readSource: (entry) => readFileSync(join(contentDir, entry.file), 'utf8'),
    title: options.title,
    description: options.description,
    locale: options.locale,
    blog: options.blog,
    seo: options.siteUrl ? { siteUrl: options.siteUrl } : undefined,
    render,
    headHTML,
    assets: { script: runtime ? 'md-book.global.js' : false },
    runtime: {
      search: options.search,
      math: options.math,
      mermaid: options.mermaid,
      theme: options.theme,
    },
  });
  for (const page of pages) write(page.file, page.html);

  if (runtime) {
    write('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
    for (const entry of manifest.entries) {
      write(join(CONTENT_DIR_NAME, entry.file), readFileSync(join(contentDir, entry.file)));
    }
    if (options.search) {
      const index = generateSearchIndex({
        contentDir,
        includeDrafts: options.drafts,
        locales: options.locales,
        defaultLocale: options.defaultLocale,
        render: { math: options.math, mermaid: options.mermaid },
      });
      write('search-index.json', `${JSON.stringify(index)}\n`);
    }
  }

  const dist = resolveDistDir(options.distDir);
  copyAsset(dist, 'style.css', write);
  if (runtime) copyAsset(dist, 'md-book.global.js', write);
  const themesDir = join(dist, 'themes');
  if (existsSync(themesDir)) {
    for (const name of readdirSync(themesDir)) {
      if (name.endsWith('.css')) write(join('themes', name), readFileSync(join(themesDir, name)));
    }
  }

  if (options.siteUrl) {
    const model = createSiteModel(manifest, options);
    const byPath = new Map(manifest.entries.map((e) => [e.path, e]));
    const site = options.siteUrl;
    write(
      'sitemap.xml',
      generateSitemap(
        pages
          .filter((p) => p.route !== '/404')
          .map((p) => ({
            loc: absoluteUrl(p.route, site),
            lastmod: lastmod(byPath.get(p.route)),
            alternates: model.alternates(p.route)?.map((a) => ({
              hreflang: a.hreflang,
              href: absoluteUrl(a.route, site),
            })),
          })),
      ),
    );

    if (options.blog) {
      const blog = options.blog === true ? {} : options.blog;
      const codes = model.setup ? model.setup.locales.map((l) => l.code) : [undefined];
      for (const code of codes) {
        const prefix = model.prefix(code).replace(/^\//, '');
        const dir = [prefix, blog.dir ?? 'blog'].filter(Boolean).join('/');
        const feedOut = join(outDir, prefix);
        mkdirSync(feedOut, { recursive: true });
        const feed = writeFeeds({
          contentDir,
          siteUrl: site,
          outDir: feedOut,
          title: model.site(code, { title: options.title ?? new URL(site).host }).title,
          description: options.description,
          language: code ?? options.locale,
          author: options.author,
          dir,
        });
        for (const f of feed.written) files.push(relative(outDir, f).split(sep).join('/'));
      }
    }
  }

  return { pages: pages.length, files };
}

// --- helpers ---------------------------------------------------------------

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function assertOutDir(contentDir: string, outDir: string): void {
  if (isInside(contentDir, outDir)) {
    throw new Error(`md-book: outDir (${outDir}) must not be inside the content directory`);
  }
  if (isInside(outDir, contentDir)) {
    throw new Error(`md-book: outDir (${outDir}) must not contain the content directory`);
  }
}

function normalizeBase(base: string): string {
  if (!base || base === '/') return '/';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

function lastmod(entry: ManifestEntry | undefined): string | undefined {
  if (!entry) return undefined;
  const date = toDate(entry.frontMatter.updated) ?? toDate(entry.frontMatter.date);
  if (date) return date.toISOString().slice(0, 10);
  return entry.mtime ? new Date(entry.mtime).toISOString().slice(0, 10) : undefined;
}

function resolveDistDir(explicit?: string): string {
  if (explicit) return resolve(explicit);
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [here, join(here, '..', 'dist'), join(here, '..', '..', 'dist')]) {
    if (existsSync(join(candidate, 'style.css'))) return candidate;
  }
  throw new Error(
    "md-book: could not find md-book's built assets (style.css). Run `npm run build` or pass distDir.",
  );
}

function copyAsset(dist: string, name: string, write: (rel: string, data: Buffer) => void): void {
  const source = join(dist, name);
  if (!existsSync(source)) throw new Error(`md-book: missing ${source}`);
  write(name, readFileSync(source));
}

async function loadKatexRenderer(): Promise<MathRenderer | null> {
  try {
    const req = createRequire(join(process.cwd(), 'noop.js'));
    const mod = (await import(pathToFileURL(req.resolve('katex')).href)) as {
      default?: { renderToString: (t: string, o: object) => string };
      renderToString?: (t: string, o: object) => string;
    };
    const katex = mod.default ?? (mod as { renderToString: (t: string, o: object) => string });
    return (tex, displayMode) => katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    process.stderr.write(
      'md-book: `katex` is not installed — math is left for the browser to typeset. `npm i -D katex` to pre-render it.\n',
    );
    return null;
  }
}
