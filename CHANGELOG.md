# @ibitsuki0296/md-book

## 0.2.0

### Minor Changes

- 8fde57d: Add UI internationalisation for runtime-generated chrome. Ships `en` (default)
  and `ja` string tables covering the pager, code-copy button, "skip to content",
  blog list / pagination / taxonomy labels, the theme-toggle `aria-label`s and the
  route error messages.

  - `mount({ locale })` and `<md-book lang="ja">` select the locale (BCP-47 tags
    accepted; unknown values fall back to `en`). `mount({ strings })` takes
    per-string overrides.
  - The resolved locale is written to `<html lang>` and emitted as `og:locale`.
  - Blog post dates are now formatted with `Intl.DateTimeFormat` for the active
    locale (the `<time datetime>` attribute stays ISO). The taxonomy lead line no
    longer bolds the term name.
  - New core exports: `resolveLocale`, `getStrings`, `createStrings`,
    `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, and the `Locale` / `UIStrings` types.

## 0.1.0

### Minor Changes

- Initial release. Runtime-first Markdown documentation & blog library:

  - Core: `renderMarkdown` (GFM, front matter, TOC, `:::` containers, footnotes,
    relative `.md` link rewriting) and a pure content model (`Manifest`,
    `resolveRoutes`, `buildNav` / `buildSidebar`, prev/next).
  - CLI `md-book`: `manifest`, `feed` (RSS / Atom / JSON), and a zero-config `dev`
    server with live reload.
  - Browser runtime: `mount()` and the `<md-book>` element — client router, app
    shell, page cache + hover prefetch, code-copy buttons, TOC scroll-spy, and a
    CDN `md-book.global.js` build.
  - Theming: the `--md-book-*` CSS custom property contract, an `@layer`
    stylesheet, light/dark, `createThemeController` + `themeInitScript`.
  - Blog: post collection, pagination, tag/category pages, and `generateFeed`.
  - SEO: canonical / Open Graph / Twitter / Article JSON-LD written on navigation.
