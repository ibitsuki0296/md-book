# @md-book/core

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
