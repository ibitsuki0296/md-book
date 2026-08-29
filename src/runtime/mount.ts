import {
  type Manifest,
  assertManifest,
  buildNav,
  buildSidebar,
  entryTitle,
  flattenPages,
  getPrevNext,
} from '../core/content.js';
import { type SlotContent, createApp } from './app.js';
import { BLOG_DEFAULTS, type BlogRuntimeConfig, resolveBlogView } from './blog.js';
import {
  type Highlighter,
  type ScrollSpy,
  addCodeCopyButtons,
  applyHighlight,
  createScrollSpy,
} from './enhance.js';
import { PageLoader, PageNotFoundError } from './page.js';
import { type Router, type RouterMode, createRouter } from './router.js';
import { type ThemeController, type ThemeMode, createThemeController } from './theme.js';

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
  const manifest = options.manifest ?? (await loadManifest(manifestUrl, options.fetchJson));
  assertManifest(manifest);

  const base = options.base ?? manifest.base ?? '/';
  const loader = new PageLoader({
    manifest,
    manifestUrl: options.manifest ? undefined : manifestUrl,
    tocDepth: options.tocDepth,
    fetchText: options.fetchText,
  });

  const orderedPages = flattenPages(buildSidebar(manifest.entries));
  const rootEntry = loader.entry('/');
  const rootTitle =
    options.title ??
    manifest.title ??
    (rootEntry ? entryTitle(rootEntry) : manifest.entries[0]?.frontMatter.title) ??
    'Documentation';
  const site = { title: rootTitle, description: options.description ?? manifest.description };

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

  const app = createApp(host, { site, router, slots: options.slots });
  app.renderNav(buildNav(manifest.entries));

  const theme = createThemeController({
    default: options.theme?.default,
    storageKey: options.theme?.storageKey,
  });
  let themeCleanup: (() => void) | undefined;
  if (options.theme?.toggle !== false) {
    themeCleanup = mountThemeToggle(app.navbarEnd, theme);
  }

  const blogConfig: BlogRuntimeConfig | null = options.blog
    ? { ...BLOG_DEFAULTS, ...(options.blog === true ? {} : options.blog) }
    : null;

  attachPrefetch(app.root, router, loader);

  async function navigateTo(path: string, hash: string): Promise<void> {
    const token = ++renderToken;

    if (blogConfig) {
      const view = resolveBlogView(path, manifest.entries, blogConfig, router, loader.has(path));
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
          sidebar: buildSidebar(manifest.entries, {
            section: view.section ?? undefined,
          }),
          toc: [],
          prevNext: {},
        });
        addCodeCopyButtons(app.article);
        document.title = `${view.title} — ${site.title}`;
        setMeta('description', site.description || '');
        scrollSpy?.disconnect();
        scrollSpy = null;
        app.setActiveHeading(null);
        afterRender(app, hash);
        return;
      }
    }

    const resolved = resolveRoute(path, loader, orderedPages);

    if (!resolved) {
      app.renderMessage('Page not found', `No page is registered for “${path}”.`);
      document.title = `Not found — ${site.title}`;
      return;
    }

    try {
      const page = await loader.load(resolved);
      if (token !== renderToken) return; // superseded by a newer navigation

      const sidebarSection = topSection(resolved);
      app.renderPage({
        path: resolved,
        title: page.frontMatter.title ?? entryTitle(page.entry),
        contentHTML: page.html,
        sidebar: buildSidebar(manifest.entries, { section: sidebarSection }),
        toc: page.toc,
        prevNext: getPrevNext(orderedPages, resolved),
      });

      addCodeCopyButtons(app.article);
      if (options.highlight) await applyHighlight(app.article, options.highlight);

      document.title = `${page.frontMatter.title ?? entryTitle(page.entry)} — ${site.title}`;
      setMeta('description', page.excerpt || site.description || '');

      scrollSpy?.disconnect();
      scrollSpy = createScrollSpy({
        content: app.article,
        ids: page.headings.map((hd) => hd.id),
        onActive: (id) => app.setActiveHeading(id),
      });

      afterRender(app, hash);
    } catch (err) {
      if (token !== renderToken) return;
      const message = err instanceof PageNotFoundError ? 'Page not found' : 'Failed to load page';
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
      themeCleanup?.();
      theme.destroy();
      router.stop();
      host.replaceChildren();
    },
  };
}

/** Adds a light/dark toggle button to the header and keeps its label in sync. */
function mountThemeToggle(navbarEnd: HTMLElement, theme: ThemeController): () => void {
  navbarEnd.hidden = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'md-book-theme-toggle';

  const sync = () => {
    const dark = theme.resolved() === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
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

function resolveRoute(
  path: string,
  loader: PageLoader,
  ordered: { path: string }[],
): string | null {
  if (loader.has(path)) return path;
  if (path === '/' && ordered.length > 0) return ordered[0]!.path;
  const withoutTrailing = path.replace(/\/+$/, '');
  if (withoutTrailing !== path && loader.has(withoutTrailing || '/')) return withoutTrailing || '/';
  return null;
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

function topSection(path: string): string {
  const seg = path.split('/').filter(Boolean)[0];
  return seg ? `/${seg}` : '/';
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

function setMeta(name: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.append(tag);
  }
  tag.content = content;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, (c) => `\\${c}`);
}
