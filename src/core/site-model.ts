/**
 * Route-level structure of a site — which entries belong to which locale, the
 * reading order, nav / sidebar sections, translations — shared by the runtime
 * router and the static renderer so both resolve pages identically.
 * Pure and DOM-free.
 */
import {
  type Manifest,
  type ManifestEntry,
  type NavItem,
  buildNav,
  buildSidebar,
  flattenPages,
} from './content.js';
import {
  type LocaleConfig,
  type LocaleSetup,
  alternatesOf,
  entriesForLocale,
  localeOfRoute,
  localePrefix,
  localeSite,
  normalizeLocales,
} from './locale.js';

export interface SiteModelOptions {
  /** Overrides the manifest's `locales`. */
  locales?: ReadonlyArray<string | LocaleConfig>;
  /** Overrides the manifest's `defaultLocale`. */
  defaultLocale?: string;
}

export interface SiteModel {
  /** Locale routing, or `null` when the site is not localised. */
  readonly setup: LocaleSetup | null;
  has(route: string): boolean;
  /** Locale of a route (`undefined` when not localised). */
  localeOf(route: string): string | undefined;
  /** Route prefix of a locale: `''` (default / not localised) or `/ja`. */
  prefix(code: string | undefined): string;
  entries(code: string | undefined): ManifestEntry[];
  /** Pages of a locale in reading order (sidebar order, depth-first). */
  ordered(code: string | undefined): ManifestEntry[];
  /** Where the brand / language switcher lands for a locale. */
  home(code: string | undefined): string;
  nav(code: string | undefined): NavItem[];
  /** Sidebar section root for a route: its first segment after the locale prefix. */
  section(route: string, code: string | undefined): string;
  /**
   * Resolves a navigated route to the page that renders it: the route itself,
   * a locale's (or the site's) root falling through to its first page, or the
   * same route without a trailing slash. `null` = not found.
   */
  resolve(route: string, code: string | undefined): string | null;
  /** `hreflang` alternates for a page that exists in 2+ locales. */
  alternates(route: string): Array<{ hreflang: string; route: string }> | undefined;
  /** Per-locale site title / description over the site-wide ones. */
  site(
    code: string | undefined,
    defaults: { title: string; description?: string },
  ): { title: string; description?: string };
}

export function createSiteModel(manifest: Manifest, options: SiteModelOptions = {}): SiteModel {
  const setup = normalizeLocales(
    options.locales ?? manifest.locales,
    options.defaultLocale ?? manifest.defaultLocale,
  );
  const paths = new Set(manifest.entries.map((e) => e.path));
  const entryCache = new Map<string, ManifestEntry[]>();
  const orderedCache = new Map<string, ManifestEntry[]>();

  const prefix = (code: string | undefined) => (setup && code ? localePrefix(code, setup) : '');
  const entries = (code: string | undefined) => {
    if (!setup || !code) return manifest.entries;
    let list = entryCache.get(code);
    if (!list) {
      list = entriesForLocale(manifest.entries, code, setup);
      entryCache.set(code, list);
    }
    return list;
  };
  const ordered = (code: string | undefined) => {
    const key = code ?? '';
    let list = orderedCache.get(key);
    if (!list) {
      list = flattenPages(buildSidebar(entries(code)));
      orderedCache.set(key, list);
    }
    return list;
  };
  const has = (route: string) => paths.has(route);

  return {
    setup,
    has,
    localeOf: (route) => (setup ? localeOfRoute(route, setup) : undefined),
    prefix,
    entries,
    ordered,
    home: (code) => {
      const home = prefix(code) || '/';
      return has(home) ? home : (ordered(code)[0]?.path ?? home);
    },
    nav: (code) => buildNav(entries(code), { section: prefix(code) || undefined }),
    section: (route, code) => {
      const pre = prefix(code);
      const seg = route.slice(pre.length).split('/').filter(Boolean)[0];
      return seg ? `${pre}/${seg}` : pre || '/';
    },
    resolve: (route, code) => {
      if (has(route)) return route;
      const list = ordered(code);
      if (route === (prefix(code) || '/') && list.length > 0) return list[0]!.path;
      const trimmed = route.replace(/\/+$/, '');
      return trimmed !== route && has(trimmed || '/') ? trimmed || '/' : null;
    },
    alternates: (route) => {
      if (!setup) return undefined;
      const found = alternatesOf(route, setup, has);
      if (found.length < 2) return undefined;
      const list = found.map((a) => ({ hreflang: a.locale.code, route: a.route }));
      const fallback = found.find((a) => a.locale.code === setup.defaultLocale);
      if (fallback) list.push({ hreflang: 'x-default', route: fallback.route });
      return list;
    },
    site: (code, defaults) => (setup && code ? localeSite(code, setup, defaults) : { ...defaults }),
  };
}
