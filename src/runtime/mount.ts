import {
  BLOG_DEFAULTS,
  type BlogRuntimeConfig,
  localizeBlogConfig,
  resolveBlogView,
} from '../core/blog-views.js';
import {
  type Manifest,
  assertManifest,
  buildSidebar,
  entryTitle,
  getPrevNext,
  stripManifestBase,
} from '../core/content.js';
import { renderHome } from '../core/home.js';
import { type UIStrings, createStrings } from '../core/i18n.js';
import { type LocaleConfig, type LocaleSetup, localizeRoute } from '../core/locale.js';
import { type Searcher, assertSearchIndex, createSearcher } from '../core/search.js';
import { createSiteModel } from '../core/site-model.js';
import { type SlotContent, createApp } from './app.js';
import {
  type Highlighter,
  type ScrollSpy,
  addCodeCopyButtons,
  applyHighlight,
  createScrollSpy,
} from './enhance.js';
import { type SeoConfig, applyHead } from './head.js';
import { PageLoader, PageNotFoundError } from './page.js';
import { type Router, type RouterMode, createRouter } from './router.js';
import { createSearchBox } from './search.js';
import { type ThemeController, type ThemeMode, createThemeController } from './theme.js';
import { type MathOptions, type MermaidOptions, typesetDiagrams, typesetMath } from './typeset.js';

export interface MountOptions {
  /** A ready manifest object. Provide this or `manifestUrl`. */
  manifest?: Manifest;
  /** URL to fetch the manifest from (default `manifest.json` next to the page). */
  manifestUrl?: string;
  /** Site base path. Defaults to the manifest's `base`. */
  base?: string;
  /** Site title for the header and `<title>`. Defaults to the root page's title. */
  title?: string;
  description?: string;
  /**
   * UI language for runtime-generated labels (pager, code-copy, blog chrome,
   * theme toggle, messages). `en` (default) or `ja`; BCP-47 tags accepted, and
   * anything unknown falls back to `en`. Also sets `<html lang>`.
   */
  locale?: string;
  /** Per-string overrides merged over the resolved locale's table. */
  strings?: Partial<UIStrings>;
  /**
   * Content-level i18n. The default locale lives at the content root, every
   * other locale under `/<code>/`; the UI language, `<html lang>`, sidebar, nav,
   * blog and search all follow the locale of the current route, and a language
   * switcher is added to the header. Overrides the manifest's `locales`.
   */
  locales?: ReadonlyArray<string | LocaleConfig>;
  /** Default locale code (routes without a prefix). Defaults to the manifest's, else the first locale. */
  defaultLocale?: string;
  /**
   * Full-text search box in the header, backed by a `search-index.json` built
   * with `md-book search-index`. `true` looks next to the manifest; pass `url`
   * to point elsewhere.
   */
  search?: boolean | { url?: string; limit?: number };
  /**
   * TeX math (`$x$`, `$$x$$`) typeset with KaTeX, loaded lazily on the first
   * page that has math. `true` uses the jsDelivr build; pass `{ load }` to self-host.
   */
  math?: boolean | MathOptions;
  /** ```mermaid diagrams drawn with Mermaid, loaded lazily. Follows the light/dark theme. */
  mermaid?: boolean | MermaidOptions;
  tocDepth?: [number, number];
  routerMode?: RouterMode;
  /** Optional syntax highlighter run over code blocks after each render. */
  highlight?: Highlighter;
  /** Theme behaviour. `toggle` (default `true`) adds a light/dark button to the header. */
  theme?: {
    default?: ThemeMode;
    storageKey?: string;
    toggle?: boolean;
  };
  /**
   * Enable blog list / pagination / tag / category routes. Pass `true` for
   * defaults (`blog/`, 10 per page, `/tags`, `/categories`) or an override.
   */
  blog?: boolean | Partial<BlogRuntimeConfig>;
  /** Social / canonical / JSON-LD metadata written to `<head>` on navigation. */
  seo?: SeoConfig;
  slots?: Partial<Record<'navbarEnd' | 'sidebarTop' | 'pageFooter', SlotContent>>;
  /** Test / transport overrides. */
  fetchText?: (url: string) => Promise<string>;
  fetchJson?: (url: string) => Promise<unknown>;
}

export interface MountHandle {
  readonly element: HTMLElement;
  readonly theme: ThemeController;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  destroy: () => void;
}

/** Mounts a md-book site into `target` (an element or a selector). */
export async function mount(
  target: HTMLElement | string,
  options: MountOptions = {},
): Promise<MountHandle> {
  const host = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!host) throw new Error(`md-book: mount target "${String(target)}" not found`);

  const manifestUrl = options.manifestUrl ?? new URL('manifest.json', document.baseURI).toString();
  const rawManifest = options.manifest ?? (await loadManifest(manifestUrl, options.fetchJson));
  assertManifest(rawManifest);
  const manifest = stripManifestBase(rawManifest);

  const base = options.base ?? manifest.base ?? '/';
  const loader = new PageLoader({
    manifest,
    manifestUrl: options.manifest ? undefined : manifestUrl,
    tocDepth: options.tocDepth,
    fetchText: options.fetchText,
    render: { math: Boolean(options.math), mermaid: Boolean(options.mermaid) },
  });

  const model = createSiteModel(manifest, {
    locales: options.locales,
    defaultLocale: options.defaultLocale,
  });
  const setup = model.setup;
  const entriesOf = model.entries;
  const orderedOf = model.ordered;
  const prefixOf = model.prefix;
  const homeOf = model.home;

  const rootEntry = loader.entry('/');
  const rootTitle =
    options.title ??
    manifest.title ??
    (rootEntry ? entryTitle(rootEntry) : manifest.entries[0]?.frontMatter.title) ??
    'Documentation';
  const siteDefaults = {
    title: rootTitle,
    description: options.description ?? manifest.description,
  };

  // Everything locale-dependent is derived from the route's locale in `activateLocale`.
  let localeCode: string | undefined = setup?.defaultLocale;
  let { locale, strings: t } = createStrings(setup ? localeCode : options.locale, options.strings);
  let langTag = setup ? (localeCode as string) : locale;
  let site = model.site(localeCode, siteDefaults);
  let seo: SeoConfig = { siteName: site.title, ...options.seo };
  if (typeof document !== 'undefined') document.documentElement.lang = langTag;

  let scrollSpy: ScrollSpy | null = null;
  let renderToken = 0;
  let firstNavigation: Promise<void> | undefined;

  const router = createRouter({
    base,
    mode: options.routerMode,
    onNavigate: (path, ctx) => {
      const pending = navigateTo(path, ctx.hash);
      firstNavigation ??= pending;
      void pending;
    },
  });

  const app = createApp(host, {
    site: { ...site, home: homeOf(localeCode) },
    router,
    strings: t,
    slots: options.slots,
  });
  app.renderNav(model.nav(localeCode));

  const theme = createThemeController({
    default: options.theme?.default,
    storageKey: options.theme?.storageKey,
  });
  const cleanups: Array<() => void> = [];
  if (options.theme?.toggle !== false) {
    cleanups.push(mountThemeToggle(app.navbarEnd, theme, () => t));
  }

  const mathOptions: MathOptions | null = options.math
    ? options.math === true
      ? {}
      : options.math
    : null;
  const mermaidOptions: MermaidOptions | null = options.mermaid
    ? options.mermaid === true
      ? {}
      : options.mermaid
    : null;
  const typeset = () => {
    if (mathOptions) void typesetMath(app.article, mathOptions);
    if (mermaidOptions) void typesetDiagrams(app.article, theme.resolved(), mermaidOptions);
  };
  if (mermaidOptions) {
    let last = theme.resolved();
    cleanups.push(
      theme.subscribe(() => {
        if (theme.resolved() === last) return;
        last = theme.resolved();
        for (const el of app.article.querySelectorAll('.md-book-mermaid--rendered')) {
          el.classList.remove('md-book-mermaid--rendered');
        }
        void typesetDiagrams(app.article, last, mermaidOptions);
      }),
    );
  }

  const blogConfig: BlogRuntimeConfig | null = options.blog
    ? { ...BLOG_DEFAULTS, ...(options.blog === true ? {} : options.blog) }
    : null;
  const blogFor = (code: string | undefined): BlogRuntimeConfig | null =>
    blogConfig ? localizeBlogConfig(blogConfig, prefixOf(code)) : null;

  let searchBox: ReturnType<typeof createSearchBox> | undefined;
  if (options.search) {
    const cfg = options.search === true ? {} : options.search;
    const searchUrl = new URL(
      cfg.url ?? 'search-index.json',
      new URL(manifestUrl, document.baseURI),
    ).toString();
    searchBox = createSearchBox({
      strings: () => t,
      href: (route) => router.href(route),
      navigate: (route) => router.navigate(route),
      locale: () => localeCode,
      limit: cfg.limit,
      load: async (): Promise<Searcher> => {
        const raw = await (options.fetchJson ?? fetchJsonDefault)(searchUrl);
        assertSearchIndex(raw);
        return createSearcher(raw);
      },
    });
    app.navbarSearch.hidden = false;
    app.navbarSearch.append(searchBox.element);
    cleanups.push(() => searchBox?.destroy());
  }

  const langSwitcher = setup ? createLanguageSwitcher(setup, () => t, switchLocale) : undefined;
  if (langSwitcher) {
    app.navbarEnd.hidden = false;
    app.navbarEnd.prepend(langSwitcher.element);
    cleanups.push(() => langSwitcher.element.remove());
  }

  attachPrefetch(app.root, router, loader);

  /** Points the shell (strings, `<html lang>`, brand, nav, switcher) at `code`'s locale. */
  function activateLocale(code: string | undefined): void {
    if (!setup || code === localeCode) return;
    localeCode = code;
    ({ locale, strings: t } = createStrings(code, options.strings));
    langTag = code ?? locale;
    site = model.site(code ?? setup.defaultLocale, siteDefaults);
    seo = { siteName: site.title, ...options.seo };
    document.documentElement.lang = langTag;
    app.setStrings(t);
    app.setSite({ ...site, home: homeOf(code) });
    app.renderNav(model.nav(code));
    langSwitcher?.sync(code);
    searchBox?.refresh();
  }

  /** Where the language switcher should send the reader for `code`. */
  function switchLocale(code: string): void {
    if (!setup) return;
    const candidate = localizeRoute(router.current, code, setup);
    const blog = blogFor(code);
    const virtual = blog ? [`/${blog.dir}`, blog.tagsBase, blog.categoriesBase] : [];
    router.navigate(model.has(candidate) || virtual.includes(candidate) ? candidate : homeOf(code));
  }

  async function navigateTo(path: string, hash: string): Promise<void> {
    const token = ++renderToken;
    const code = model.localeOf(path);
    activateLocale(code);
    const blog = blogFor(code);

    if (blog) {
      const view = resolveBlogView(path, manifest.entries, blog, router, loader.has(path), {
        strings: t,
        locale: langTag,
      });
      if (view) {
        let leadingHTML = '';
        if (view.hasOwnPage) {
          try {
            const page = await loader.load(path);
            if (token !== renderToken) return;
            leadingHTML = page.html;
          } catch {
            // fall back to the generated list only
          }
        }
        app.renderPage({
          path,
          title: view.title,
          contentHTML: leadingHTML + view.html,
          sidebar: buildSidebar(entriesOf(code), {
            section: view.section ?? undefined,
          }),
          toc: [],
          prevNext: {},
        });
        addCodeCopyButtons(app.article, t);
        typeset();
        applyHead(
          {
            title: `${view.title} — ${site.title}`,
            description: site.description || '',
            routePath: path,
            type: 'website',
            locale: langTag,
          },
          seo,
        );
        scrollSpy?.disconnect();
        scrollSpy = null;
        app.setActiveHeading(null);
        afterRender(app, hash);
        return;
      }
    }

    const resolved = model.resolve(path, code);

    if (!resolved) {
      app.renderMessage(t.pageNotFound, t.pageNotFoundBody(path));
      document.title = t.notFoundDocTitle(site.title);
      return;
    }

    try {
      const page = await loader.load(resolved);
      if (token !== renderToken) return; // superseded by a newer navigation

      app.renderPage({
        path: resolved,
        title: page.frontMatter.title ?? entryTitle(page.entry),
        contentHTML:
          page.frontMatter.layout === 'home'
            ? `${renderHome(page.frontMatter, (link) => router.href(link))}\n${page.html}`
            : page.html,
        sidebar: buildSidebar(entriesOf(code), { section: model.section(resolved, code) }),
        toc: page.toc,
        prevNext: getPrevNext(orderedOf(code), resolved),
        layout: page.frontMatter.layout,
        writing: page.frontMatter.writing,
      });

      addCodeCopyButtons(app.article, t);
      if (options.highlight) await applyHighlight(app.article, options.highlight);
      typeset();

      const pageTitle = page.frontMatter.title ?? entryTitle(page.entry);
      const isArticle = Boolean(
        blog && resolved.startsWith(`/${blog.dir}/`) && page.frontMatter.date,
      );
      applyHead(
        {
          title: `${pageTitle} — ${site.title}`,
          description: page.excerpt || site.description || '',
          routePath: resolved,
          type: isArticle ? 'article' : 'website',
          locale: langTag,
          alternates: model.alternates(resolved),
          image: typeof page.frontMatter.cover === 'string' ? page.frontMatter.cover : undefined,
          publishedTime: isoOrUndefined(page.frontMatter.date),
          modifiedTime: isoOrUndefined(page.frontMatter.updated),
          author: typeof page.frontMatter.author === 'string' ? page.frontMatter.author : undefined,
          tags: Array.isArray(page.frontMatter.tags)
            ? page.frontMatter.tags.filter((tag): tag is string => typeof tag === 'string')
            : undefined,
        },
        seo,
      );

      scrollSpy?.disconnect();
      scrollSpy = createScrollSpy({
        content: app.article,
        ids: page.headings.map((hd) => hd.id),
        onActive: (id) => app.setActiveHeading(id),
      });

      afterRender(app, hash);
    } catch (err) {
      if (token !== renderToken) return;
      const message = err instanceof PageNotFoundError ? t.pageNotFound : t.failedToLoad;
      app.renderMessage(message, (err as Error).message);
    }
  }

  router.start();
  await firstNavigation;

  return {
    element: app.root,
    theme,
    navigate: router.navigate,
    destroy: () => {
      scrollSpy?.disconnect();
      for (const cleanup of cleanups) cleanup();
      theme.destroy();
      router.stop();
      host.replaceChildren();
    },
  };
}

/** A `<select>` that lists the site's locales and reports the chosen one. */
function createLanguageSwitcher(
  setup: LocaleSetup,
  strings: () => UIStrings,
  onSelect: (code: string) => void,
): { element: HTMLElement; sync: (code: string | undefined) => void } {
  const select = document.createElement('select');
  select.className = 'md-book-lang__select';
  for (const locale of setup.locales) {
    const option = document.createElement('option');
    option.value = locale.code;
    option.lang = locale.code;
    option.textContent = locale.label ?? locale.code;
    select.append(option);
  }
  select.value = setup.defaultLocale;
  select.addEventListener('change', () => onSelect(select.value));

  const element = document.createElement('div');
  element.className = 'md-book-lang';
  element.append(select);
  const label = () => select.setAttribute('aria-label', strings().languageLabel);
  label();

  return {
    element,
    sync: (code) => {
      if (code) select.value = code;
      label();
    },
  };
}

/** Adds a light/dark toggle button to the header and keeps its label in sync. */
function mountThemeToggle(
  navbarEnd: HTMLElement,
  theme: ThemeController,
  strings: () => UIStrings,
): () => void {
  navbarEnd.hidden = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'md-book-theme-toggle';

  const sync = () => {
    const dark = theme.resolved() === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? strings().switchToLight : strings().switchToDark);
    button.setAttribute('aria-pressed', String(dark));
  };
  sync();

  const onClick = () => theme.toggle();
  button.addEventListener('click', onClick);
  const unsubscribe = theme.subscribe(sync);

  navbarEnd.append(button);
  return () => {
    button.removeEventListener('click', onClick);
    unsubscribe();
    button.remove();
  };
}

function afterRender(app: ReturnType<typeof createApp>, hash: string): void {
  app.focusContent();
  if (hash) {
    const target = app.article.querySelector(`#${cssEscape(hash)}`);
    if (target) {
      target.scrollIntoView();
      return;
    }
  }
  app.content.scrollTo?.({ top: 0 });
  window.scrollTo?.({ top: 0 });
}

function attachPrefetch(root: HTMLElement, router: Router, loader: PageLoader): void {
  const handler = (event: Event) => {
    const anchor = (event.target as Element | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!href) return;
    try {
      const url = new URL(anchor!.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const path = href.startsWith('#') ? href.slice(1).split('#')[0]! : stripToRoute(url, router);
      if (path) loader.prefetch(path);
    } catch {
      // ignore malformed hrefs
    }
  };
  root.addEventListener('mouseover', handler);
  root.addEventListener('focusin', handler);
}

function stripToRoute(url: URL, router: Router): string {
  // Reuse the router's notion of "current" base by comparing hrefs.
  const marker = router.href('/');
  const basePath = marker.startsWith('#') ? '/' : new URL(marker, 'http://localhost').pathname;
  if (basePath === '/') return url.pathname;
  return url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length - 1) : url.pathname;
}

async function loadManifest(
  url: string,
  fetchJson?: (url: string) => Promise<unknown>,
): Promise<Manifest> {
  if (fetchJson) return (await fetchJson(url)) as Manifest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`md-book: failed to fetch manifest ${url} (${res.status})`);
  return (await res.json()) as Manifest;
}

function fetchJsonDefault(url: string): Promise<unknown> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`md-book: failed to fetch ${url} (${res.status})`);
    return res.json();
  });
}

function isoOrUndefined(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, (c) => `\\${c}`);
}
