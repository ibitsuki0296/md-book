/**
 * Content-level i18n: locale routing.
 *
 * Layout convention (VitePress-style): the default locale lives at the content
 * root, every other locale under a directory named after its code —
 *
 *   content/guide/intro.md     →  /guide/intro        (default locale)
 *   content/ja/guide/intro.md  →  /ja/guide/intro     (ja)
 *
 * Everything here works on **route paths with the site base already stripped**
 * (what the runtime router reports). Pure and DOM-free.
 */

export interface LocaleConfig {
  /** Route-prefix code, e.g. `ja` or `pt-br`. Also the UI-language hint. */
  code: string;
  /** Name shown in the language switcher. Defaults to a built-in name, else the code. */
  label?: string;
  /** Per-locale site title / description (fall back to the site-wide ones). */
  title?: string;
  description?: string;
}

export interface LocaleSetup {
  locales: LocaleConfig[];
  defaultLocale: string;
}

const BUILTIN_LABELS: Record<string, string> = {
  en: 'English',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  it: 'Italiano',
  ru: 'Русский',
};

const CODE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

/**
 * Validates and normalises a locale list. Returns `null` for "not localised"
 * (no list, or a single locale — there is nothing to route between).
 */
export function normalizeLocales(
  input: ReadonlyArray<string | LocaleConfig> | undefined | null,
  defaultLocale?: string,
): LocaleSetup | null {
  if (!input || input.length === 0) return null;
  const locales: LocaleConfig[] = [];
  for (const item of input) {
    const config = typeof item === 'string' ? { code: item } : { ...item };
    const code = config.code?.trim();
    if (!code || !CODE.test(code))
      throw new Error(`md-book: invalid locale code "${String(code)}"`);
    if (locales.some((l) => l.code.toLowerCase() === code.toLowerCase())) {
      throw new Error(`md-book: duplicate locale "${code}"`);
    }
    locales.push({
      ...config,
      code,
      label: config.label ?? BUILTIN_LABELS[code.split('-')[0]!.toLowerCase()] ?? code,
    });
  }
  if (locales.length < 2) return null;
  const fallback = locales[0]!.code;
  const wanted = defaultLocale?.trim() || fallback;
  const match = locales.find((l) => l.code.toLowerCase() === wanted.toLowerCase());
  if (!match) throw new Error(`md-book: default locale "${wanted}" is not in the locale list`);
  return { locales, defaultLocale: match.code };
}

/** Route prefix for a locale: `''` for the default locale, `/ja` otherwise. */
export function localePrefix(code: string, setup: LocaleSetup): string {
  return code === setup.defaultLocale ? '' : `/${code}`;
}

/** Which locale a (base-stripped) route belongs to. */
export function localeOfRoute(route: string, setup: LocaleSetup): string {
  const first = route.split('/').filter(Boolean)[0];
  if (first) {
    const match = setup.locales.find((l) => l.code === first);
    if (match && match.code !== setup.defaultLocale) return match.code;
  }
  return setup.defaultLocale;
}

/** Removes the locale prefix: `/ja/guide` → `/guide`, `/ja` → `/`. */
export function stripLocale(route: string, setup: LocaleSetup): string {
  const code = localeOfRoute(route, setup);
  if (code === setup.defaultLocale) return route || '/';
  const rest = route.slice(`/${code}`.length);
  return rest === '' ? '/' : rest;
}

/** The same page in another locale: `/guide` + `ja` → `/ja/guide`. */
export function localizeRoute(route: string, code: string, setup: LocaleSetup): string {
  const neutral = stripLocale(route, setup);
  const prefix = localePrefix(code, setup);
  if (!prefix) return neutral;
  return neutral === '/' ? prefix : `${prefix}${neutral}`;
}

/** Entries that belong to one locale (by route prefix). */
export function entriesForLocale<T extends { path: string }>(
  entries: readonly T[],
  code: string,
  setup: LocaleSetup,
): T[] {
  return entries.filter((e) => localeOfRoute(e.path, setup) === code);
}

export interface LocaleAlternate {
  locale: LocaleConfig;
  route: string;
}

/** Translations of `route` that exist, per `has` (the current locale is included). */
export function alternatesOf(
  route: string,
  setup: LocaleSetup,
  has: (route: string) => boolean,
): LocaleAlternate[] {
  const out: LocaleAlternate[] = [];
  for (const locale of setup.locales) {
    const candidate = localizeRoute(route, locale.code, setup);
    if (has(candidate)) out.push({ locale, route: candidate });
  }
  return out;
}

/** `{ title, description }` for a locale, falling back to the site-wide values. */
export function localeSite(
  code: string,
  setup: LocaleSetup,
  fallback: { title: string; description?: string },
): { title: string; description?: string } {
  const config = setup.locales.find((l) => l.code === code);
  return {
    title: config?.title ?? fallback.title,
    description: config?.description ?? fallback.description,
  };
}
