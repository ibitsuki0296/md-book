# @ibitsuki0296/md-book

Runtime-first Markdown **documentation & blog** library with token-based theming.

Write content in Markdown, drop in a `manifest.json`, and render a full docs/blog
site in the browser — no build step required. Or run `md-book build` for a
pre-rendered static site (SSG), or plug the content pipeline into Vite, Astro or
Next.js. The core is deliberately pure, so the runtime, the SSG and the adapters
all share it.

> **Status: 0.1.0 published; unreleased on `main`:** UI i18n, the design refresh,
> vertical writing, and — new — a static-build (SSG) mode, Vite / Astro / Next
> adapters, client-side full-text search, KaTeX math, Mermaid diagrams and
> content-level i18n (locale routing). All implemented and tested.

## Why "md-book"

The bare npm name `md-book` was taken, so the package publishes as
`@ibitsuki0296/md-book`. The project, repo, and CLI keep the name `md-book`.

## Install

```bash
npm install @ibitsuki0296/md-book
```

## Core API (implemented now)

`renderMarkdown()` turns a Markdown document into HTML plus the structured
metadata the runtime and SSG layers need. It never touches the DOM or the
filesystem.

```ts
import { renderMarkdown } from '@ibitsuki0296/md-book';

const { html, frontMatter, toc, headings, excerpt } = renderMarkdown(source, {
  tocDepth: [2, 3],
  linkRewrite: { currentPath: '/guide/intro', base: '/' },
});
```

What the core handles:

- CommonMark + GFM (tables, strikethrough, task lists, autolinks)
- YAML front matter (`title`, `date`, `tags`, `draft`, `order`, …)
- Slugged heading ids + clickable permalink anchors
- Nested table of contents built from a configurable heading-level range
- `:::note` / `:::warning` / `:::details` container blocks
- Rewriting relative `*.md` links (and `index.md` / `README.md`) to route paths
- Footnotes, external-link `rel` hardening
- First-paragraph excerpt (front-matter `description` wins)

Raw HTML in the source is escaped unless you pass `allowHtml: true`.

## Content model & CLI (implemented now)

`generateManifest()` (and the `md-book manifest` CLI) walk a content directory
into a `manifest.json`: one entry per page with its resolved route path, front
matter, and sort key. `YYYY-MM-DD-` blog prefixes and `NN-` ordering prefixes
are stripped from routes; drafts are excluded by default.

```bash
npx md-book manifest ./content --base /          # writes content/manifest.json
npx md-book dev --root . --content ./content     # static server + live reload + /manifest.json
```

Add `--locales en,ja` for a multi-language site
([Content i18n](#content-i18n-locale-routing)), and `md-book search-index` for the
search box ([Search](#search)). Pure helpers for laying out a site: `resolveRoutes` (flat entries → route tree),
`buildNav`, `buildSidebar` (section-scoped, draft-aware), `flattenPages` +
`getPrevNext`, and `assertManifest` for validating a fetched manifest.

## Browser runtime (implemented now)

The runtime renders a full site in the browser from a manifest — no build step.

```html
<md-book manifest="/manifest.json" base="/" router="history"></md-book>
<script src="https://cdn.example/@ibitsuki0296/md-book/md-book.global.js"></script>
```

or programmatically:

```ts
import { mount } from '@ibitsuki0296/md-book/runtime';

const site = await mount('#app', { manifestUrl: '/manifest.json' });
site.navigate('/guide/getting-started');
```

It builds the shell (skip link, header nav, sidebar, content, TOC rail, prev/next
pager, footer), runs a History-API (or `hash`) client router that intercepts
internal links and prefetches on hover, fetches + renders each page through the
core, adds copy buttons to code blocks, tracks the active heading for the TOC,
and keeps `<title>` / `meta[description]` in sync. Fenced code gets built-in
syntax highlighting (js/ts, json, css, html, sh, yaml, python, diff); pass
`highlight: (code, lang) => html` to plug in a fuller highlighter, and
`locale: 'ja'` to localise the generated UI (see [Internationalisation](#internationalisation-implemented-now)).

Run the example site (`examples/docs/`):

```bash
npm run example   # build + serve at http://localhost:4173
```

## Theming (implemented now)

The public theming API is a set of namespaced CSS custom properties
(`--md-book-*`) in `dist/style.css`. Everything the runtime renders is styled
through them, so **a theme is just a stylesheet that redefines tokens** — load it
after `style.css`:

```html
<link rel="stylesheet" href="@ibitsuki0296/md-book/style.css" />
<link rel="stylesheet" href="@ibitsuki0296/md-book/themes/ink.css" />   <!-- or your own -->
```

The bundled rules live in `@layer md-book.tokens, .base, .layout, .content,
.components`, so any unlayered rule you add wins without specificity fights.
`themes/default.css` is a copy-paste template listing every token.

Light/dark: tokens are redefined for `@media (prefers-color-scheme: dark)` (unless
`data-theme="light"`) and for `data-theme="dark"`. The runtime `createThemeController()`
sets `data-theme` on `<html>`, persists the choice, emits `md-book:themechange`,
and `mount()` adds a header toggle (disable with `theme: { toggle: false }`).
Paste `themeInitScript()` into `<head>` to avoid a flash of the wrong theme.

`npm run validate:tokens` fails the build if a raw colour literal sneaks into a
component stylesheet instead of a token.

### Theme playground

An interactive editor for the token contract lives in `examples/playground/`:

```bash
npm run playground   # build + serve at http://localhost:4180
```

Tweak colours, typography, and layout/shape — with **light and dark edited
independently** — while a real `<md-book>` site (the `examples/docs` content)
re-styles live in a preview frame. Seed from a built-in theme (`default`, `ink`),
then **Copy** or **Download** the result as a drop-in stylesheet (`:root` +
`:root[data-theme="dark"]` + an optional `@media (prefers-color-scheme: dark)`
block), matching the format of `themes/ink.css`.

It is local tooling — vanilla ES modules, no build step, and not part of the
published package. `examples/playground/tokens.js` mirrors `src/styles/tokens.css`
and must be kept in sync when tokens change.

## Blog (implemented now)

Any dated Markdown file under `blog/` (configurable) is a post. Enable the blog
routes with `blog: true` (or `<md-book blog blog-per-page="10">`):

- `/blog` — post list, newest first, paginated (`/blog/page/2`, …). If
  `blog/index.md` exists its body is rendered above the list.
- `/tags` and `/tags/:slug`, `/categories` and `/categories/:slug` — taxonomy
  index and per-term post lists.

Drafts (`draft: true`) and future-dated posts are hidden. List cards show the
front-matter `description` as the summary.

Core helpers — `collectPosts`, `paginate`, `groupByTag` / `groupByCategory` — and
`generateFeed(posts, options, 'rss' | 'atom' | 'json')` are exported for build
tools. The CLI writes all three:

```bash
npx md-book feed ./content --site-url https://example.com/ --title "My blog"
# -> content/feed.xml, content/atom.xml, content/feed.json
```

## Internationalisation (implemented now)

The strings the runtime renders itself — pager, code-copy button, skip link,
blog list / pagination / taxonomy labels, theme-toggle `aria-label`s, and the
route error messages — are translatable. `en` (default) and `ja` ship built in.

```html
<md-book manifest="/manifest.json" base="/" lang="ja"></md-book>
```

```ts
await mount('#app', {
  manifestUrl: '/manifest.json',
  locale: 'ja',                     // BCP-47 tags accepted; unknown -> 'en'
  strings: { copy: 'クリップボードへ' }, // optional per-string overrides
});
```

The resolved locale is written to `<html lang>` and emitted as `og:locale`, and
blog post dates are formatted with `Intl.DateTimeFormat` for it (the
`<time datetime>` attribute stays ISO).

The tables and helpers are pure and exported for an SSG layer:

```ts
import {
  resolveLocale,   // 'ja-JP' -> 'ja', unknown -> 'en'
  getStrings,      // full UIStrings table for a locale
  createStrings,   // resolve + shallow-merge overrides
  SUPPORTED_LOCALES,
  type UIStrings,
} from '@ibitsuki0296/md-book';
```

Add a UI language by extending `src/core/i18n.ts`. To translate page **content**,
see [Content i18n](#content-i18n-locale-routing) below.

## Search

A full-text search box in the header, built from a JSON index — no server and no
extra dependency. Japanese (and any language without spaces) works because it
matches normalised substrings rather than words; full-width / half-width forms
are unified and every term must match (AND).

```bash
npx md-book search-index ./content            # -> content/search-index.json
```

```html
<md-book manifest="/manifest.json" search></md-book>     <!-- or mount({ search: true }) -->
```

`search` looks for `search-index.json` next to the manifest (`search="/x.json"` /
`search: { url, limit }` to override). The index is fetched the first time someone
types; press `/` or `Ctrl`/`⌘`+`K` to focus the box. Results show the page, the
matching section heading and a highlighted snippet, and follow the current locale
on localised sites. `md-book dev` serves `/search-index.json` live.

Core: `extractSearchDoc`, `createSearchIndex`, `createSearcher` (all pure);
runtime: `createSearchBox`. Tune the index with `--max-chars` (body text kept per
page, default 8000).

## Math & diagrams

Both are opt-in and load their library **lazily, only on pages that use them**
— nothing is added to the bundle.

```html
<md-book manifest="/manifest.json" math mermaid></md-book>
```

- **Math** (KaTeX): `$inline$` and `$$display$$` (single- or multi-line). Pandoc-style
  delimiting keeps prose like "costs $5 and $10" untouched. Escaped TeX is emitted
  in `.md-book-math` elements until KaTeX typesets it.
- **Diagrams** (Mermaid): fence a block with <code>```mermaid</code>. Rendered with
  `securityLevel: 'strict'` and redrawn when the light/dark theme changes.

By default the ES builds are imported from jsDelivr. To self-host or bundle, pass
your own loader:

```ts
await mount('#app', {
  math:    { load: () => import('katex'), katex: { macros: { '\\R': '\\mathbb{R}' } } },
  mermaid: { load: () => import('mermaid'), config: { flowchart: { htmlLabels: false } } },
});
```

(Under a strict CSP, self-host and allow the script/style origins you use.) In the
core, `renderMarkdown(src, { math: true | { render }, mermaid: true })` — pass
`render: (tex, display) => katex.renderToString(tex, { displayMode: display })`
to typeset at render time, which is what `md-book build --math` does when `katex`
is installed in your project.

## Content i18n (locale routing)

Serve a site in several languages. The **default locale lives at the content root**
and every other locale in a directory named after its code:

```
content/guide/intro.md      →  /guide/intro       (en, default)
content/ja/guide/intro.md   →  /ja/guide/intro    (ja)
content/ja/index.md         →  /ja                (ja home)
```

```bash
npx md-book manifest ./content --locales en,ja                 # or en:English,ja:日本語
npx md-book dev --content ./content --locales en,ja
```

The manifest records `locales` / `defaultLocale` (and `entry.locale`), so the
runtime needs no extra configuration. Then, per route:

- the UI language, `<html lang>` and `og:locale` follow the page's locale;
- nav, sidebar, prev/next, blog routes (`/ja/blog`, `/ja/tags`) and search are
  scoped to that locale;
- a language switcher appears in the header and jumps to the **same page** in the
  other language, or to that locale's home when it has no translation;
- translated pages get `<link rel="alternate" hreflang>` (plus `x-default`).

Give each locale its own title with `{ code: 'ja', label: '日本語', title: '…' }`
(`mount({ locales })` or the manifest). Directory sections show their folder name
in the nav; add an `index.md` with a `title` to a section to name it. For feeds use
`md-book feed … --dir ja/blog --out …` (or `md-book build`, which writes one per
locale).

## Static build (SSG)

`md-book build` pre-renders every route to real HTML — app shell, content, TOC,
pager, canonical / Open Graph / hreflang / JSON-LD — for crawlers, link previews
and no-JS readers. The pages still carry the runtime, which takes over on load, so
client-side navigation, search and the theme toggle keep working.

```bash
npx md-book build ./content --out dist-site \
  --site-url https://example.com/ --locales en,ja --blog --search --math --mermaid
```

The output contains `index.html` for each route (plus blog pages, tags,
categories and a `404.html` that doubles as an SPA fallback), `manifest.json`,
`search-index.json`, `sitemap.xml`, blog feeds, the raw Markdown, and
`md-book.global.js` / `style.css` / `themes/`. Serve it from any static host; for a
project-page deployment add `--base /repo/` and make `--site-url` include it.
`--head <file>` injects extra `<head>` HTML (fonts, analytics), `--theme` sets the
default theme, `--no-runtime` emits plain HTML + CSS only. It refuses to write
inside the content directory. Draft and future-dated content follows the same
rules as the runtime (future-dated posts are evaluated at build time).

Programmatic: `import { buildSite, renderSite } from '@ibitsuki0296/md-book/node'`.
`renderSite` is pure (sources in, `{ file, html }[]` out); the shell it emits is
kept in lock-step with the runtime's DOM by a parity test.

## Framework adapters

Feed the content pipeline into an existing app. Each adapter generates
`manifest.json`, `search-index.json` and the raw Markdown (base-aware, live in
dev, emitted on build) — you mount `<md-book>` / `mount()` in your own page and
import `@ibitsuki0296/md-book/style.css`.

```ts
// vite.config.ts
import { mdBook } from '@ibitsuki0296/md-book/vite';
export default defineConfig({ plugins: [mdBook({ contentDir: 'content' })] });
// also: import manifest from 'virtual:md-book/manifest'
```

```js
// astro.config.mjs
import { mdBook } from '@ibitsuki0296/md-book/astro';
export default defineConfig({ integrations: [mdBook({ contentDir: 'content' })] });
```

```js
// next.config.mjs — writes into public/ (add the generated files to .gitignore)
import { withMdBook } from '@ibitsuki0296/md-book/next';
export default withMdBook({ contentDir: 'content' })({ /* your Next config */ });
```

Options (all adapters): `contentDir` (default `content`), `title`, `description`,
`locales` / `defaultLocale`, `search` (default `true`), `drafts` (dev always
includes them), `base` (defaults to Vite `base` / Astro `base` / Next `basePath`).
Adapter types are structural, so `vite`, `astro` and `next` are not dependencies.
All three were exercised against real projects (Vite 6.4, Astro 7.3, Next.js 16.3:
dev server, build, base / `basePath`, and — for Next — live regeneration in
`next dev`); the repo's own tests cover them with fakes, since those frameworks are
not dependencies. Vite's plugin type-checks against Vite's `Plugin`.

## Development

```bash
npm install
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run build         # tsup -> dist/ (ESM + CJS + d.ts + CLI + adapters + CSS) + SRI hash
npm run lint          # biome
npm run size          # size-limit (CDN bundle budget)
npm run validate:tokens
npm run example       # build + serve examples/docs at :4173
npm run playground    # build + serve the theme playground at :4180
```

`examples/docs/` is both the dev-server fixture and the documentation site
(md-book dogfooding itself).

Releases are driven by [Changesets](https://github.com/changesets/changesets):
`npx changeset` to note a change, then CI runs `npm run release` (build +
`changeset publish` with npm provenance) on merge to `main`. `pre-commit` runs
Biome + typecheck via lefthook; CI additionally runs tests, build, size, and the
token validator. `dist/md-book.global.js.sri` holds the Subresource Integrity
hash for the CDN `<script>`.

## Roadmap

See [`plans/…dynamic-hinton.md`](../../.claude/plans/javascript-markdown-dynamic-hinton.md)
for the full requirements doc. Milestones:

| | |
|---|---|
| **M1 core** *(done)* | Markdown pipeline, front matter, TOC, link rewrite, containers |
| **M2 content model** *(done)* | Manifest type + validation, route resolution, nav/sidebar, prev/next, `md-book manifest` + `md-book dev` |
| **M3 runtime UI** *(done)* | `<md-book>` element + `mount()`, client router, app shell, page loader/cache, scroll-spy, code copy, CDN global build |
| **M4 theming** *(done)* | `--md-book-*` token contract, `@layer` stylesheet, light/dark, theme controller + FOUC guard + header toggle, reference themes, token validator |
| **M5 blog** *(done)* | `collectPosts` + date sort, `paginate`, tag/category grouping, list / pagination / taxonomy routes in the runtime, `generateFeed` (RSS/Atom/JSON) + `md-book feed` |
| **M6 hardening** *(done)* | SEO head (canonical / OG / Twitter / Article JSON-LD), a11y structure + tests, `size-limit`, SRI hash, GitHub Actions CI, lefthook, Changesets, docs content, `0.1.0` |
| **UI i18n** *(done, unreleased)* | `en` / `ja` string tables (`src/core/i18n.ts`), `mount({ locale })` + `<md-book lang>`, `<html lang>` / `og:locale` sync, `Intl`-formatted blog dates |
| **Search** *(done, unreleased)* | `md-book search-index`, CJK-friendly client search, header search box (`/` and `⌘K`), per-locale results |
| **Math & diagrams** *(done, unreleased)* | `$…$` / `$$…$$` KaTeX and ```` ```mermaid ```` diagrams, lazy-loaded, theme-aware, build-time KaTeX |
| **Content i18n** *(done, unreleased)* | Locale routing, `--locales`, language switcher, per-locale nav / blog / search, hreflang |
| **SSG** *(done, unreleased)* | `md-book build`: pre-rendered pages + sitemap + feeds, runtime takes over on load |
| **Adapters** *(done, unreleased)* | `@ibitsuki0296/md-book/{vite,astro,next,node}` |

## License

MIT © Hazuki ABE
