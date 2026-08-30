# @ibitsuki0296/md-book

Runtime-first Markdown **documentation & blog** library with token-based theming.

Write content in Markdown, drop in a `manifest.json`, and render a full docs/blog
site in the browser — no build step required. A static-site (SSG) mode and
framework adapters come later; the core is deliberately pure so both layers can
share it.

> **Status: 0.1.0.** Core rendering, the content model + CLI, the browser
> runtime, token theming, blog, and SEO metadata are implemented and tested
> (114 tests). Next: a static-build (SSG) mode and framework adapters.

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

Pure helpers for laying out a site: `resolveRoutes` (flat entries → route tree),
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
and keeps `<title>` / `meta[description]` in sync. Pass `highlight: (code, lang)
=> html` to plug in a syntax highlighter, and `locale: 'ja'` to localise the
generated UI (see [Internationalisation](#internationalisation-implemented-now)).

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

Add a locale by extending `src/core/i18n.ts`. Translating page **content**
(locale routing, per-locale manifests) is not in scope yet.

## Development

```bash
npm install
npm test              # vitest
npm run typecheck     # tsc --noEmit
npm run build         # tsup -> dist/ (ESM + CJS + d.ts + CLI + CSS) + SRI hash
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
| next | Static-build (SSG) mode; Astro / Vite / Next adapters; client-side search; Mermaid / KaTeX; content-level i18n (locale routing) |

## License

MIT © Hazuki ABE
