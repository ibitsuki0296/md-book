/**
 * Static site generation: renders every route of a site to a complete HTML
 * document — pre-rendered app shell + content + SEO head — as strings. The
 * caller (the `md-book build` CLI, or an adapter) supplies file contents and
 * writes the result; nothing here touches the filesystem or the DOM.
 *
 * Each page carries the same `<md-book>` element and asset tags a hand-written
 * page would, so the runtime mounts over the pre-rendered markup: the HTML is
 * complete for crawlers and no-JS readers, and client-side navigation, search,
 * theme toggle etc. take over afterwards.
 */
import {
  BLOG_DEFAULTS,
  type BlogRuntimeConfig,
  localizeBlogConfig,
  resolveBlogView,
} from './blog-views.js';
import { collectPosts, groupByCategory, groupByTag, paginate } from './blog.js';
import {
  type Manifest,
  type ManifestEntry,
  buildSidebar,
  entryTitle,
  getPrevNext,
} from './content.js';
import {
  type HeadData,
  type SeoConfig,
  buildHead,
  escapeAttr,
  escapeText,
  headToHTML,
} from './head.js';
import { renderHome } from './home.js';
import { type UIStrings, createStrings } from './i18n.js';
import { renderMarkdown } from './render.js';
import { renderShell } from './shell.js';
import { type SiteModelOptions, createSiteModel } from './site-model.js';
import { DEFAULT_THEME_STORAGE_KEY, themeInitScript } from './theme-script.js';
import type { RenderOptions, TocEntry } from './types.js';

export interface SiteRenderInput extends SiteModelOptions {
  /**
   * Entry routes must be **relative to the base** (`/guide/intro`, not
   * `/docs/guide/intro`); `manifest.base` is the deployment base path.
   */
  manifest: Manifest;
  /** Raw Markdown for an entry. */
  readSource: (entry: ManifestEntry) => string;
  title?: string;
  description?: string;
  /** UI language for a non-localised site (`en` / `ja`). Localised sites follow each route's locale. */
  locale?: string;
  strings?: Partial<UIStrings>;
  /** Blog list / pagination / tag / category routes, as in `mount({ blog })`. */
  blog?: boolean | Partial<BlogRuntimeConfig>;
  seo?: SeoConfig;
  /** Markdown options (`allowHtml`, `math: { render }`, `mermaid`, `tocDepth`, …). */
  render?: Omit<RenderOptions, 'linkRewrite'>;
  /** Extra HTML for `<head>` (fonts, analytics, a theme stylesheet, …). */
  headHTML?: string;
  /** Asset URLs relative to the base. `script: false` omits the runtime entirely. */
  assets?: { style?: string; script?: string | false };
  /** Features to switch on for the mounted runtime (attributes on `<md-book>`). */
  runtime?: {
    search?: boolean;
    math?: boolean;
    mermaid?: boolean;
    theme?: string;
    router?: 'history' | 'hash';
  };
  themeStorageKey?: string;
}

export interface SitePage {
  /** Route this page serves (`/guide/intro`), or `/404`. */
  route: string;
  /** Output path relative to the site root, e.g. `guide/intro/index.html`. */
  file: string;
  html: string;
  /** Page title, for logging / sitemaps. */
  title: string;
}

/** Renders every page of the site, plus `404.html`. */
export function renderSite(input: SiteRenderInput): SitePage[] {
  const manifest = input.manifest;
  const base = normalizeBase(manifest.base);
  const model = createSiteModel(manifest, input);
  const setup = model.setup;
  const href = (to: string): string => {
    const hashAt = to.indexOf('#');
    const route = hashAt === -1 ? to : to.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : to.slice(hashAt);
    const path = route || '/';
    return `${base === '/' ? path : `${base}${path === '/' ? '' : path}`}${hash}`;
  };

  const rootEntry = manifest.entries.find((e) => e.path === '/');
  const siteDefaults = {
    title:
      input.title ??
      manifest.title ??
      (rootEntry ? entryTitle(rootEntry) : manifest.entries[0]?.frontMatter.title) ??
      'Documentation',
    description: input.description ?? manifest.description,
  };
  const blogBase: BlogRuntimeConfig | null = input.blog
    ? { ...BLOG_DEFAULTS, ...(input.blog === true ? {} : input.blog) }
    : null;

  const byPath = new Map(manifest.entries.map((e) => [e.path, e]));
  const rendered = new Map<string, Rendered>();
  const renderEntry = (entry: ManifestEntry, route: string): Rendered => {
    const key = `${entry.path}\0${route}`;
    let out = rendered.get(key);
    if (!out) {
      out = {
        ...renderMarkdown(input.readSource(entry), {
          ...input.render,
          linkRewrite: { currentPath: entry.path, base },
        }),
        entry,
      };
      rendered.set(key, out);
    }
    return out;
  };

  const localeCodes = setup ? setup.locales.map((l) => l.code) : [undefined];
  const blogFor = (code: string | undefined) =>
    blogBase ? localizeBlogConfig(blogBase, model.prefix(code)) : null;

  // --- route list ---------------------------------------------------------
  const routes = new Set<string>(manifest.entries.map((e) => e.path));
  for (const code of localeCodes) {
    routes.add(model.prefix(code) || '/'); // falls through to the first page when there is no index
    const blog = blogFor(code);
    if (!blog) continue;
    const posts = collectPosts(manifest.entries, { dir: blog.dir, hideFuture: true });
    const root = `/${blog.dir}`;
    routes.add(root);
    const pages = paginate(posts, blog.perPage, 1).pageCount;
    for (let n = 2; n <= pages; n++) routes.add(`${root}/page/${n}`);
    routes.add(blog.tagsBase);
    for (const g of groupByTag(posts)) routes.add(`${blog.tagsBase}/${g.slug}`);
    routes.add(blog.categoriesBase);
    for (const g of groupByCategory(posts)) routes.add(`${blog.categoriesBase}/${g.slug}`);
  }

  // --- one route → one document ------------------------------------------
  const renderRoute = (route: string): SitePage => {
    const code = model.localeOf(route) ?? setup?.defaultLocale;
    const { locale: uiLocale, strings: t } = createStrings(
      setup ? code : input.locale,
      input.strings,
    );
    const langTag = setup ? (code as string) : uiLocale;
    const site = model.site(code, siteDefaults);
    const seo: SeoConfig = { siteName: site.title, ...input.seo };
    const blog = blogFor(code);
    const nav = model.nav(code);
    const home = model.home(code);

    let title: string;
    let description = site.description ?? '';
    let contentHTML: string;
    let sidebar = buildSidebar(model.entries(code), { section: model.section(route, code) });
    let toc: TocEntry[] = [];
    let prevNext = {} as ReturnType<typeof getPrevNext>;
    let layout: string | undefined;
    let writing: string | undefined;
    let shellPath = route;
    let headExtra: Partial<Parameters<typeof buildHead>[0]> = {};

    const view = blog
      ? resolveBlogView(route, manifest.entries, blog, { href }, byPath.has(route), {
          strings: t,
          locale: langTag,
        })
      : null;

    if (view) {
      const own = view.hasOwnPage ? byPath.get(route) : undefined;
      contentHTML = (own ? renderEntry(own, route).html : '') + view.html;
      title = view.title;
      sidebar = buildSidebar(model.entries(code), { section: view.section ?? undefined });
      headExtra = {};
    } else {
      const resolved = model.resolve(route, code);
      const entry = resolved ? byPath.get(resolved) : undefined;
      if (!resolved || !entry) return notFound(route);
      const page = renderEntry(entry, resolved);
      shellPath = resolved;
      title = page.frontMatter.title ?? entryTitle(entry);
      contentHTML =
        page.frontMatter.layout === 'home'
          ? `${renderHome(page.frontMatter, href)}\n${page.html}`
          : page.html;
      toc = page.toc;
      prevNext = getPrevNext(model.ordered(code), resolved);
      layout = page.frontMatter.layout;
      writing = page.frontMatter.writing;
      description = page.excerpt || site.description || '';
      const fm = page.frontMatter;
      const isArticle = Boolean(blog && resolved.startsWith(`/${blog.dir}/`) && fm.date);
      headExtra = {
        routePath: resolved,
        type: isArticle ? 'article' : 'website',
        alternates: model.alternates(resolved),
        image: typeof fm.cover === 'string' ? fm.cover : undefined,
        publishedTime: isoOrUndefined(fm.date),
        modifiedTime: isoOrUndefined(fm.updated),
        author: typeof fm.author === 'string' ? fm.author : undefined,
        tags: Array.isArray(fm.tags)
          ? fm.tags.filter((x): x is string => typeof x === 'string')
          : undefined,
      };
    }

    const head = buildHead(
      {
        title: `${title} — ${site.title}`,
        description,
        routePath: route,
        type: 'website',
        locale: langTag,
        ...headExtra,
      },
      seo,
    );

    const shell = renderShell({
      site,
      strings: t,
      href,
      home,
      nav,
      path: shellPath,
      page: { contentHTML, sidebar, toc, prevNext, layout, writing },
      languages: setup ? { locales: setup.locales, current: code as string } : undefined,
    });
    return {
      route,
      file: routeToFile(route),
      title,
      html: renderDocument(input, model, base, langTag, head, shell),
    };
  };

  const notFound = (route: string): SitePage => {
    const code = setup?.defaultLocale;
    const { locale: uiLocale, strings: t } = createStrings(
      setup ? code : input.locale,
      input.strings,
    );
    const site = model.site(code, siteDefaults);
    const shell = renderShell({
      site,
      strings: t,
      href,
      home: model.home(code),
      nav: model.nav(code),
      path: '/404',
      page: {
        contentHTML: `<h1>${escapeText(t.pageNotFound)}</h1><p>${escapeText(t.pageNotFoundBody(route))}</p>`,
        sidebar: [],
        toc: [],
        prevNext: {},
      },
      languages: setup ? { locales: setup.locales, current: code as string } : undefined,
    });
    const head: HeadData = { title: t.notFoundDocTitle(site.title), tags: [] };
    const langTag = setup ? (code as string) : uiLocale;
    return {
      route: '/404',
      file: '404.html',
      title: t.pageNotFound,
      html: renderDocument(input, model, base, langTag, head, shell),
    };
  };

  const pages = [...routes].sort().map(renderRoute);
  pages.push(notFound('/404'));
  return pages;
}

/** Route → output file: `/` → `index.html`, `/a/b` → `a/b/index.html`. */
export function routeToFile(route: string): string {
  const segments = route.split('/').filter(Boolean);
  if (segments.some((s) => s === '.' || s === '..' || /[\\\0]/.test(s))) {
    throw new Error(`md-book: refusing to write route "${route}" outside the output directory`);
  }
  return segments.length === 0 ? 'index.html' : `${segments.join('/')}/index.html`;
}

// --- internals -------------------------------------------------------------

interface Rendered extends ReturnType<typeof renderMarkdown> {
  entry: ManifestEntry;
}

function renderDocument(
  input: SiteRenderInput,
  model: ReturnType<typeof createSiteModel>,
  base: string,
  langTag: string,
  head: HeadData,
  shell: string,
): string {
  const assets = input.assets ?? {};
  const style = assets.style ?? 'style.css';
  const script = assets.script === undefined ? 'md-book.global.js' : assets.script;
  const url = (file: string) => escapeAttr(base === '/' ? `/${file}` : `${base}/${file}`);
  const rt = input.runtime ?? {};
  const blog = input.blog ? { ...BLOG_DEFAULTS, ...(input.blog === true ? {} : input.blog) } : null;

  const attrs: string[] = [
    `manifest="${url('manifest.json')}"`,
    `base="${escapeAttr(base)}"`,
    `router="${rt.router ?? 'history'}"`,
  ];
  if (!model.setup && input.locale) attrs.push(`lang="${escapeAttr(input.locale)}"`);
  if (rt.theme) attrs.push(`theme="${escapeAttr(rt.theme)}"`);
  if (blog) {
    attrs.push('blog');
    if (blog.dir !== BLOG_DEFAULTS.dir) attrs.push(`blog-dir="${escapeAttr(blog.dir)}"`);
    if (blog.perPage !== BLOG_DEFAULTS.perPage) attrs.push(`blog-per-page="${blog.perPage}"`);
  }
  if (input.seo?.siteUrl) attrs.push(`site-url="${escapeAttr(input.seo.siteUrl)}"`);
  if (rt.search) attrs.push('search');
  if (rt.math) attrs.push('math');
  if (rt.mermaid) attrs.push('mermaid');

  const themeKey = input.themeStorageKey ?? DEFAULT_THEME_STORAGE_KEY;
  return `${[
    '<!doctype html>',
    `<html lang="${escapeAttr(langTag)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    headToHTML(head),
    `<script>${themeInitScript(themeKey).replace(/<\/script/gi, '<\\/script')}</script>`,
    `<link rel="stylesheet" href="${url(style)}">`,
    input.headHTML ?? '',
    '</head>',
    '<body>',
    script === false
      ? `<div class="md-book-static">${shell}</div>`
      : `<md-book ${attrs.join(' ')}>${shell}</md-book>`,
    script === false ? '' : `<script src="${url(script)}"></script>`,
    '</body>',
    '</html>',
  ]
    .filter((line) => line !== '')
    .join('\n')}\n`;
}

function normalizeBase(base: string): string {
  if (!base || base === '/') return '/';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

function isoOrUndefined(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}
