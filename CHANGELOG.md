# @ibitsuki0296/md-book

## 0.2.1

### Patch Changes

- 217cda7: Ship `THIRD_PARTY_LICENSES.txt` (licences of the packages bundled into the CDN/CJS builds), reference it from a banner in `md-book.global.js`, and copy it next to the runtime in `md-book build` output.

## 0.2.0

### Minor Changes

- 824c21e: Add client-side full-text search.

  - `md-book search-index <contentDir>` writes `search-index.json` (per page: title,
    headings, normalised plain text); `md-book dev` serves it live.
  - `mount({ search: true })` / `<md-book search>` adds a header search box: a
    combobox with a live results list, highlighted snippets, arrow / Enter / Esc
    keys, and `/` or `Ctrl`/`⌘`+`K` to focus. The index is fetched on first input.
  - The engine matches normalised substrings (AND over terms, title > heading > body
    ranking, NFKC width folding), so Japanese and other unspaced text works without a
    tokenizer, and it adds no dependency. Results follow the current locale.
  - Core: `extractSearchDoc`, `createSearchIndex`, `createSearcher`, `assertSearchIndex`,
    `htmlToText`. Runtime: `createSearchBox`. New tokens-only styles and UI strings
    (`en` / `ja`).

- 824c21e: Add content-level i18n (locale routing).

  - The default locale lives at the content root, other locales under `/<code>/`
    (`ja/guide/intro.md` → `/ja/guide/intro`). Declare them with
    `md-book manifest --locales en,ja` (also `dev`, `build`, `search-index`, and the
    adapters), `mount({ locales })`, or the manifest's new `locales` /
    `defaultLocale` fields (entries get `locale`).
  - The runtime follows the route's locale: UI strings, `<html lang>` and `og:locale`,
    per-locale site title, nav, sidebar, prev/next, blog routes (`/ja/blog`,
    `/ja/tags`) and search scope. A language switcher jumps to the same page in
    another locale (or that locale's home), and translated pages emit
    `<link rel="alternate" hreflang>` incl. `x-default`.
  - Core helpers: `normalizeLocales`, `localeOfRoute`, `localizeRoute`, `stripLocale`,
    `entriesForLocale`, `alternatesOf`, `createSiteModel`; `buildNav` gains
    `{ section }`.

- 824c21e: Add Vite, Astro and Next.js adapters.

  - `@ibitsuki0296/md-book/vite` — `mdBook({ contentDir })` plugin: serves
    `manifest.json`, `search-index.json` and the raw Markdown from the dev server
    (full reload on edit), emits them on `vite build`, and exposes the manifest as
    `virtual:md-book/manifest`.
  - `@ibitsuki0296/md-book/astro` — integration with the same behaviour via Astro's
    `astro:server:setup` / `astro:build:done` hooks.
  - `@ibitsuki0296/md-book/next` — `withMdBook({ contentDir })(nextConfig)` writes the
    files into `public/` and keeps them fresh in `next dev`. `basePath` is picked up.
  - All adapters take `contentDir`, `title`, `description`, `locales`, `defaultLocale`,
    `search`, `drafts`, `base`, and respect the host's base path. Types are structural,
    so `vite` / `astro` / `next` are not dependencies.

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

- 824c21e: Add KaTeX math and Mermaid diagrams (opt-in, lazy-loaded).

  - `math`: `$inline$` and `$$display$$` (single- or multi-line) with Pandoc-style
    delimiting so prose such as "costs $5 and $10" is untouched. TeX is emitted
    escaped in `.md-book-math` elements; `RenderOptions.math` also accepts
    `{ render }` to typeset at render time (used by `md-book build --math` when
    `katex` is installed).
  - `mermaid`: ` ```mermaid ` fences become `<pre class="md-book-mermaid">`;
    drawn with `securityLevel: 'strict'` and redrawn on light/dark changes.
  - Enable in the runtime with `mount({ math, mermaid })` or `<md-book math mermaid>`.
    KaTeX / Mermaid load from jsDelivr on the first page that needs them, or from your
    own `load: () => import('katex')`; nothing is added to the bundle.

- e71de1e: Modernise the default design and add built-in syntax highlighting.

  - Refreshed default theme: neutral zinc palette with an indigo accent, softer
    borders, larger radii (`--md-book-radius` 0.75rem, `--md-book-radius-sm`
    0.375rem), tighter heading type, no more `h2` underline. Token names are
    unchanged; only default values moved, so custom themes keep working.
  - Callouts are rounded cards with a glyph badge; tables are bordered cards with
    row dividers; code blocks get a border, a language label and a hover copy
    button (always visible on touch devices).
  - Fenced code is highlighted at render time (js/ts, json, css, html, bash, yaml,
    python, diff) with a tiny built-in tokenizer. New tokens:
    `--md-book-color-tok-{comment,keyword,string,number,function,type,attr}`.
    New core export `highlightCode`, and a `highlight` render option
    (default `true`). `mount({ highlight })` still overrides it.
  - Refreshed chrome: pill-style nav and sidebar states, a titled TOC rail with
    aligned nesting, card-style pager and blog posts, a hairline sticky header.
  - On narrow screens (<= 760px) the sidebar is now an off-canvas drawer opened by
    a header menu button (Escape / backdrop / link click close it). New UI string
    `menuLabel` (en: "Menu", ja: "メニュー").
  - The TOC rail now shows an "On this page" title (`.md-book-toc__title`).
  - Default font stacks now prefer Inter and JetBrains Mono when available (they
    are not downloaded automatically).
  - New `layout: home` landing page: front-matter `hero` (name, text, tagline,
    actions) and `features` render as a hero and feature cards on a full-width
    layout. New core export `renderHome` and `HomeHero` / `HomeAction` /
    `HomeFeature` types.
  - Sidebar siblings without an explicit `order` now sort by `date` (newest first)
    before title, so the blog section is listed in date order.

- 824c21e: Add a static-build (SSG) mode: `md-book build`.

  - `md-book build <contentDir> --out dist-site` pre-renders every route to a full
    HTML document — app shell, content, TOC, pager, canonical / Open Graph / hreflang
    / Article JSON-LD — plus `404.html` (an SPA fallback), blog list / pagination /
    tag / category pages, `sitemap.xml` and blog feeds. The pages still load the
    runtime, which takes over on load, so navigation, search and the theme toggle
    keep working; `--no-runtime` emits plain HTML + CSS.
  - Options: `--base`, `--site-url`, `--title`, `--description`, `--lang`,
    `--locales`, `--blog`, `--search`, `--math`, `--mermaid`, `--theme`, `--head`.
  - Programmatic API on the new `@ibitsuki0296/md-book/node` entry (`buildSite`,
    `renderSite`, `generateManifest`, `generateSearchIndex`, `writeFeeds`,
    `startDevServer`, `generateSitemap`). New core modules `renderShell` /
    `renderSite` / `buildHead` / `headToHTML` are pure; a parity test keeps the
    pre-rendered shell identical to the runtime's DOM.
  - Fix: the runtime now strips the base from a manifest generated with
    `--base /docs/`, so sites deployed under a sub-path resolve their routes.
  - Fix: the CJS builds (`require('@ibitsuki0296/md-book')`) no longer crash in
    `renderMarkdown` — `github-slugger` (ESM-only) is bundled into them.

- 72ed2a1: Add vertical writing (縦書き) for publishing tanka and other Japanese text.

  - Front-matter `writing: vertical` sets the article in vertical-rl: fixed-height,
    right-to-left columns that scroll sideways (the mouse wheel is mapped to it).
    `FrontMatter.writing` is typed; the app root gets `md-book--vertical` and the
    article `md-book-article--vertical`.
  - New `:::tanka` container: a poem block that keeps source line breaks.
  - New `:::vertical` container and a `.vertical` modifier for any container
    (`:::tanka.vertical 題`) set a single block in vertical writing inside a
    horizontal page (fixed-height, sideways scroll when it overflows).
  - New ruby (ふりがな) syntax `{漢字|かんじ}` →
    `<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>`; both parts are escaped,
    heading ids / excerpts use the base text. Opt out with `ruby: false`
    (new `RenderOptions.ruby`).
  - New tokens `--md-book-font-serif` (mincho stack) and
    `--md-book-vertical-height`.

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
