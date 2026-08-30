/**
 * UI localisation for runtime-generated chrome (pager, code-copy button,
 * blog list / taxonomy labels, theme toggle, "page not found", …).
 *
 * Pure: no DOM, no `node:*`, no filesystem. The runtime and a future SSG layer
 * consume {@link getStrings} / {@link createStrings}; date formatting is left to
 * the caller (`Intl.DateTimeFormat`) so this module ships zero locale data.
 */

/** Locales that ship a full {@link UIStrings} table. */
export const SUPPORTED_LOCALES = ['en', 'ja'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Locale used when none is given or the requested one is unknown. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Every user-visible string the runtime renders itself. Plain strings unless a
 * value needs positional interpolation, in which case it is a function.
 */
export interface UIStrings {
  // App shell
  skipToContent: string;
  mainNavLabel: string;
  sidebarLabel: string;
  pageNavLabel: string;
  onThisPageLabel: string;
  previous: string;
  next: string;

  // Theme toggle
  switchToLight: string;
  switchToDark: string;

  // Code copy button
  copy: string;
  copied: string;
  copyFailed: string;
  copyAriaLabel: string;

  // Route messages
  pageNotFound: string;
  pageNotFoundBody: (path: string) => string;
  failedToLoad: string;
  notFoundDocTitle: (siteTitle: string) => string;

  // Blog
  blog: string;
  blogListPageTitle: (page: number) => string;
  noPostsYet: string;
  tagsIndexTitle: string;
  categoriesIndexTitle: string;
  tagKind: string;
  categoryKind: string;
  taxonomyPageTitle: (kind: string, name: string) => string;
  nothingTaggedWith: (name: string) => string;
  taxonomyLead: (count: number, name: string) => string;
  allOfKind: (kind: string) => string;
  noneYet: string;
  paginationStatus: (page: number, pageCount: number) => string;
  newer: string;
  older: string;
  blogPagesLabel: string;
}

const en: UIStrings = {
  skipToContent: 'Skip to content',
  mainNavLabel: 'Main navigation',
  sidebarLabel: 'Sidebar',
  pageNavLabel: 'Page navigation',
  onThisPageLabel: 'On this page',
  previous: 'Previous',
  next: 'Next',

  switchToLight: 'Switch to light theme',
  switchToDark: 'Switch to dark theme',

  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Failed',
  copyAriaLabel: 'Copy code to clipboard',

  pageNotFound: 'Page not found',
  pageNotFoundBody: (path) => `No page is registered for “${path}”.`,
  failedToLoad: 'Failed to load page',
  notFoundDocTitle: (siteTitle) => `Not found — ${siteTitle}`,

  blog: 'Blog',
  blogListPageTitle: (page) => `Blog — page ${page}`,
  noPostsYet: 'No posts yet.',
  tagsIndexTitle: 'Tags',
  categoriesIndexTitle: 'Categories',
  tagKind: 'Tag',
  categoryKind: 'Category',
  taxonomyPageTitle: (kind, name) => `${kind}: ${name}`,
  nothingTaggedWith: (name) => `Nothing tagged “${name}”.`,
  taxonomyLead: (count, name) => `${count} ${count === 1 ? 'post' : 'posts'} tagged ${name}.`,
  allOfKind: (kind) => `All ${kind.toLowerCase()}s`,
  noneYet: 'None yet.',
  paginationStatus: (page, pageCount) => `Page ${page} of ${pageCount}`,
  newer: '← Newer',
  older: 'Older →',
  blogPagesLabel: 'Blog pages',
};

const ja: UIStrings = {
  skipToContent: '本文へスキップ',
  mainNavLabel: 'メインナビゲーション',
  sidebarLabel: 'サイドバー',
  pageNavLabel: 'ページ送り',
  onThisPageLabel: 'このページの内容',
  previous: '前へ',
  next: '次へ',

  switchToLight: 'ライトテーマに切り替え',
  switchToDark: 'ダークテーマに切り替え',

  copy: 'コピー',
  copied: 'コピーしました',
  copyFailed: '失敗しました',
  copyAriaLabel: 'コードをクリップボードにコピー',

  pageNotFound: 'ページが見つかりません',
  pageNotFoundBody: (path) => `“${path}” に対応するページがありません。`,
  failedToLoad: 'ページの読み込みに失敗しました',
  notFoundDocTitle: (siteTitle) => `見つかりません — ${siteTitle}`,

  blog: 'ブログ',
  blogListPageTitle: (page) => `ブログ — ${page} ページ目`,
  noPostsYet: 'まだ投稿がありません。',
  tagsIndexTitle: 'タグ',
  categoriesIndexTitle: 'カテゴリ',
  tagKind: 'タグ',
  categoryKind: 'カテゴリ',
  taxonomyPageTitle: (kind, name) => `${kind}: ${name}`,
  nothingTaggedWith: (name) => `“${name}” が付いた投稿はありません。`,
  taxonomyLead: (count, name) => `${name} が付いた投稿 ${count} 件。`,
  allOfKind: (kind) => `${kind}一覧`,
  noneYet: 'まだありません。',
  paginationStatus: (page, pageCount) => `${pageCount} ページ中 ${page} ページ目`,
  newer: '← 新しい記事',
  older: '古い記事 →',
  blogPagesLabel: 'ブログのページ送り',
};

const dictionaries: Record<Locale, UIStrings> = { en, ja };

/**
 * Resolves an arbitrary locale hint to a supported {@link Locale}. Matching is
 * case-insensitive and falls back to the primary subtag (`ja-JP` → `ja`);
 * anything unknown (or missing) resolves to {@link DEFAULT_LOCALE}.
 */
export function resolveLocale(input: string | undefined | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const lower = input.toLowerCase();
  if (isLocale(lower)) return lower;
  const primary = lower.split('-')[0] ?? '';
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

/** The full string table for a supported locale. */
export function getStrings(locale: Locale): UIStrings {
  return dictionaries[locale];
}

/**
 * Resolves `input` to a locale and returns its string table, with any
 * `overrides` shallow-merged on top (function entries are replaced wholesale).
 */
export function createStrings(
  input: string | undefined | null,
  overrides?: Partial<UIStrings>,
): { locale: Locale; strings: UIStrings } {
  const locale = resolveLocale(input);
  const base = dictionaries[locale];
  return { locale, strings: overrides ? { ...base, ...overrides } : base };
}

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
