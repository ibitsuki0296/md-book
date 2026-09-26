# @ibitsuki0296/md-book

**Turn a folder of Markdown files into a documentation site or blog.** Use it with no
build step at all, pre-render it to static HTML, or plug it into Vite, Astro or Next.js.

**[Live demo → ibitsuki0296.github.io/md-book](https://ibitsuki0296.github.io/md-book/)**
(the demo site is built from [`examples/docs/`](examples/docs) with `md-book build`).

```
content/
├─ index.md
├─ guide/
│  ├─ 01-getting-started.md
│  └─ 02-configuration.md
└─ blog/
   └─ 2026-02-01-hello-world.md
```

## Features

- **Docs and blog in one** — sidebar, table of contents, prev/next pager, dated posts with
  pagination, tags, categories and RSS / Atom / JSON feeds.
- **Three ways to run it** — render in the browser, pre-render to static HTML (SSG), or use
  the Vite / Astro / Next.js adapters.
- **Themeable** — every colour, font and size is a `--md-book-*` CSS variable. Light and dark
  mode built in, no flash on load.
- **Full-text search** — runs in the browser from a JSON index, and works well for Japanese
  and other languages that don't put spaces between words.
- **Math and diagrams** — KaTeX (`$x^2$`) and Mermaid, loaded only on pages that use them.
- **Multilingual** — translate the UI (English and Japanese included) and serve whole sites
  in several languages, with a language switcher and `hreflang` tags.
- **Vertical writing** — 縦書き layout and ruby (furigana) for Japanese text such as tanka.
- **SEO-ready** — canonical URLs, Open Graph / Twitter tags, JSON-LD and a sitemap.
- **Accessible and safe by default** — semantic landmarks, skip link, keyboard navigation;
  raw HTML in Markdown is escaped unless you opt in.
- **Small and dependency-light** — the whole browser bundle is about 94 kB gzipped.

## Quick start

Install:

```bash
npm install @ibitsuki0296/md-book
```

Requires Node 24 or newer for the CLI and adapters. The browser runtime runs in any modern browser.

### Option A — Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { mdBook } from '@ibitsuki0296/md-book/vite';

export default defineConfig({
  plugins: [mdBook({ contentDir: 'content', title: 'My Docs' })],
});
```

```html
<!-- index.html -->
<div id="app"></div>
<script type="module" src="/src/main.ts"></script>
```

```ts
// src/main.ts
import '@ibitsuki0296/md-book/style.css';
import { mount } from '@ibitsuki0296/md-book/runtime';

mount('#app', { manifestUrl: '/manifest.json', search: true });
```

Put Markdown files in `content/` and run `vite`. The plugin serves `manifest.json`,
`search-index.json` and your Markdown from the dev server (reloading when you edit), and emits
them on `vite build`.

Astro and Next.js work the same way — see [Framework adapters](#framework-adapters).

### Option B — a plain HTML page

Copy `style.css` and `md-book.global.js` from `node_modules/@ibitsuki0296/md-book/dist/` next to
your page, then:

```html
<!-- index.html -->
<link rel="stylesheet" href="/style.css" />
<md-book manifest="/manifest.json" search blog></md-book>
<script src="/md-book.global.js"></script>
```

```bash
npx md-book dev --root . --content ./content
```

`md-book dev` serves the page with live reload and generates `/manifest.json` from `./content`
on the fly. For production, generate the files once with `npx md-book manifest ./content` and
upload them with your page.

### Option C — pre-rendered static site

No HTML to write at all:

```bash
npx md-book build ./content --out dist-site --title "My Docs" \
  --site-url https://example.com/ --blog --search
```

Upload `dist-site/` to any static host. See [Static build](#static-build-ssg).

## Writing content

### Files and routes

| File | Route |
|---|---|
| `content/index.md` | `/` |
| `content/guide/01-getting-started.md` | `/guide/getting-started` |
| `content/blog/2026-02-01-hello-world.md` | `/blog/hello-world` |

- A leading `NN-` sets the order in the sidebar and is removed from the URL.
- A leading `YYYY-MM-DD-` marks a blog post and is removed from the URL.
- Files named `index.md` (or `README.md`) become the page for their folder.
- Relative links between pages (`[setup](./02-configuration.md)`) are rewritten to routes.

### Front matter

```yaml
---
title: Page title
description: Used for the excerpt and the meta description
date: 2026-02-01        # makes the page a blog post
updated: 2026-02-10
tags: [guide, intro]
categories: [Handbook]
draft: true             # hidden from production output
order: 2                # sidebar position among siblings
slug: custom-slug       # overrides the slug derived from the file name
layout: home            # landing page with hero and feature cards
writing: vertical       # vertical writing (縦書き)
---
```

### Markdown

Standard CommonMark plus GitHub-flavoured extras: tables, task lists, strikethrough,
autolinks and footnotes. Headings get anchor links, and code blocks get syntax
highlighting (JavaScript / TypeScript, JSON, CSS, HTML, shell, YAML, Python, diff) and a copy
button.

Callouts use fenced containers:

```md
:::note
Context the reader can skim past.
:::

:::warning Heads up
Something that can bite later.
:::

:::details Click to expand
Hidden until opened.
:::
```

Available types: `note`, `tip`, `info`, `warning`, `danger`, `details`.

### Landing page

`layout: home` gives a full-width page with a hero and feature cards:

```yaml
---
title: My project
layout: home
hero:
  name: v1.0
  text: A headline that sells it
  tagline: One supporting sentence.
  actions:
    - text: Get started
      link: /guide/getting-started
    - text: GitHub
      link: https://github.com/you/project
      theme: alt
features:
  - title: Just Markdown
    details: Short description.
---
```

## Ways to run md-book

| | Browser runtime | Static build (SSG) | Framework adapters |
|---|---|---|---|
| You provide | A page with `<md-book>` and a manifest | A folder of Markdown | A Vite / Astro / Next.js project |
| Output | Pages rendered in the browser | Real HTML for every route | Manifest, search index and Markdown served / emitted for your app |
| Good for | Quick setups, no build step | Public sites: SEO, link previews, no-JS readers | Adding docs to an existing app |

All three share the same rendering code, so a page looks the same in each.

### Browser runtime

`<md-book>` (or `mount()`) fetches the manifest, then renders each page on demand. It provides
the header, sidebar, table of contents, pager and footer, client-side navigation with hover
prefetching, code copy buttons, TOC scroll-spy, a light/dark toggle and SEO tags.

`<md-book>` attributes:

| Attribute | Meaning |
|---|---|
| `manifest` | URL of `manifest.json` |
| `base` | Site base path, e.g. `/docs/` |
| `router` | `history` (default) or `hash` |
| `heading` | Site title for the header and `<title>` |
| `lang` | UI language: `en` or `ja` |
| `theme` | Initial mode: `light`, `dark` or `system` |
| `blog`, `blog-dir`, `blog-per-page` | Enable and configure the blog |
| `search` | Add the search box |
| `math`, `mermaid` | Turn on math and diagrams |
| `site-url` | Absolute site URL for canonical / Open Graph links |

Children with `slot="navbar-end"`, `slot="sidebar-top"` or `slot="page-footer"` are placed in
those parts of the page.

The same options are available programmatically:

```ts
import { mount } from '@ibitsuki0296/md-book/runtime';

const site = await mount('#app', {
  manifestUrl: '/manifest.json',
  locale: 'ja',
  search: true,
  math: true,
  blog: { perPage: 10 },
  theme: { default: 'system', toggle: true },
  seo: { siteUrl: 'https://example.com/' },
});

site.navigate('/guide/getting-started');
```

### Static build (SSG)

`md-book build` pre-renders every route into real HTML — including the shell, table of
contents, canonical / Open Graph / `hreflang` / JSON-LD tags — for crawlers, link previews and
readers without JavaScript. The pages still carry the runtime, which takes over after load, so
client-side navigation, search and the theme toggle keep working.

```bash
npx md-book build ./content --out dist-site \
  --site-url https://example.com/ --locales en,ja --blog --search --math --mermaid
```

The output has an `index.html` per route (plus blog list, tag and category pages and a
`404.html`), `manifest.json`, `search-index.json`, `sitemap.xml`, feeds, the raw Markdown and
the runtime assets. For a project page such as GitHub Pages, add `--base /repo/` and include
the base in `--site-url`. See [`.github/workflows/pages.yml`](.github/workflows/pages.yml) for a
complete GitHub Pages deployment.

Useful options: `--head <file>` injects extra `<head>` HTML (fonts, analytics), `--theme` sets
the default theme, and `--no-runtime` emits plain HTML and CSS only.

From code: `import { buildSite, renderSite } from '@ibitsuki0296/md-book/node'`.

### Framework adapters

Each adapter generates `manifest.json`, `search-index.json` and the raw Markdown — live during
development and emitted on build. You mount `<md-book>` or `mount()` in your own page and import
`@ibitsuki0296/md-book/style.css`.

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

The Vite plugin also exposes the manifest as `import manifest from 'virtual:md-book/manifest'`.

Options: `contentDir` (default `content`), `title`, `description`, `locales`, `defaultLocale`,
`search` (default `true`), `drafts` and `base` (taken from the framework's own base path
unless you set it). `vite`, `astro` and `next` are not dependencies of md-book.

## Blog

Any dated Markdown file under `blog/` is a post. Turn the blog on with `blog` (attribute) or
`blog: true` (option); the static build takes `--blog`.

- `/blog` — posts newest first, paginated (`/blog/page/2`, …). If `blog/index.md` exists, its
  text is shown above the list.
- `/tags`, `/tags/:slug`, `/categories`, `/categories/:slug` — taxonomy pages.

Drafts and future-dated posts are hidden. Generate feeds with:

```bash
npx md-book feed ./content --site-url https://example.com/ --title "My blog"
# → feed.xml, atom.xml, feed.json
```

`md-book build --site-url …` writes the feeds for you (one set per language on multilingual
sites).

## Search

A search box in the header, built from a JSON index. There is no server and no extra dependency.

```bash
npx md-book search-index ./content    # → content/search-index.json
```

```html
<md-book manifest="/manifest.json" search></md-book>
```

Matching works on normalised substrings rather than words, so Japanese works out of the box, and
full-width and half-width characters are treated alike. Every search term must match. Results
show the page, the matching heading and a highlighted snippet. Press `/` or `Ctrl`/`⌘`+`K` to
focus the box. On multilingual sites, results follow the current language.

## Math and diagrams

Both are opt-in and their libraries load only on pages that use them.

```html
<md-book manifest="/manifest.json" math mermaid></md-book>
```

- **Math:** `$inline$` and `$$display$$` are typeset with KaTeX. Text like "costs $5 and $10" is
  left alone.
- **Diagrams:** fence a block with `mermaid`. Diagrams follow the light/dark theme.

The libraries are loaded from jsDelivr by default. To self-host, pass your own loader:

```ts
await mount('#app', {
  math: { load: () => import('katex') },
  mermaid: { load: () => import('mermaid') },
});
```

For static builds, install `katex` (`npm i -D katex`) and `md-book build --math` pre-renders
formulas at build time.

## Multiple languages

**UI language.** The text md-book generates itself (pager, buttons, blog labels, messages) comes
in `en` and `ja`.

```html
<md-book manifest="/manifest.json" lang="ja"></md-book>
```

```ts
mount('#app', { locale: 'ja', strings: { copy: 'クリップボードへ' } }); // override single strings
```

**Translated content.** The default language lives at the content root; every other language
lives in a folder named after its code.

```
content/guide/intro.md      →  /guide/intro       (default: en)
content/ja/guide/intro.md   →  /ja/guide/intro    (ja)
content/ja/index.md         →  /ja                (ja home)
```

```bash
npx md-book dev --content ./content --locales en,ja
npx md-book build ./content --locales en,ja        # or en:English,ja:日本語
```

The site then gets a language switcher that jumps to the same page in the other language,
per-language navigation, blog and search, `<html lang>`, and `hreflang` alternates.

## Vertical writing

For Japanese text such as tanka, set `writing: vertical` in a page's front matter to lay the
whole page out top-to-bottom, right-to-left. Use `:::vertical` to set a single block vertically
inside a normal page, and `:::tanka` for poems that keep their line breaks. Ruby is written as
`{漢字|かんじ}`.

```md
---
title: 短歌
writing: vertical
---

:::tanka
{東海|とうかい}の{小島|こじま}の{磯|いそ}の{白砂|しろすな}に
われ{泣|な}きぬれて
{蟹|かに}とたはむる
:::
```

## Theming

The look is controlled by CSS variables prefixed `--md-book-*`. **A theme is a stylesheet that
redefines some of them**, loaded after `style.css`:

```ts
import '@ibitsuki0296/md-book/style.css';
import '@ibitsuki0296/md-book/themes/ink.css';   // a bundled theme (optional)
import './my-theme.css';                         // your overrides
```

```css
/* my-theme.css */
:root {
  --md-book-brand-600: #0d9488;
  --md-book-font-body: "Noto Sans JP", system-ui, sans-serif;
  --md-book-measure: 52rem;            /* reading width */
}
:root[data-theme="dark"] {
  --md-book-color-bg: #0b1020;
}
```

md-book's own styles sit inside CSS `@layer`s, so your plain CSS always wins — no `!important`
needed. `themes/default.css` lists every variable and is a good starting template. Two themes
ship in the package: `default` and `ink`.

Light/dark: the theme follows the system setting until the reader uses the header toggle (their
choice is remembered). Paste `themeInitScript()` into `<head>` to avoid a flash of the wrong
theme.

**Theme playground.** `npm run playground` (in this repository) opens a live editor: change
colours, fonts and spacing, with light and dark edited separately, then copy or download the
result as a stylesheet.

## Command line

```bash
md-book manifest <contentDir>        # scan Markdown into manifest.json
md-book search-index <contentDir>    # build search-index.json
md-book feed <contentDir>            # write RSS / Atom / JSON feeds
md-book build <contentDir>           # pre-render a static site
md-book dev                          # dev server with live reload
```

Run `md-book --help` for every option.

## Package contents

| Import | What it is |
|---|---|
| `@ibitsuki0296/md-book` | Pure functions: `renderMarkdown`, manifest and nav helpers, blog helpers, feeds, search, i18n. No DOM, no filesystem. |
| `@ibitsuki0296/md-book/runtime` | `<md-book>`, `mount()`, theme controller and other browser code |
| `@ibitsuki0296/md-book/node` | `buildSite`, `renderSite` and the generators |
| `@ibitsuki0296/md-book/{vite,astro,next}` | Framework adapters |
| `@ibitsuki0296/md-book/style.css`, `/themes/*` | Stylesheet and bundled themes |
| `dist/md-book.global.js` | Single-file browser bundle for a `<script>` tag (exposes `window.MdBook`); `md-book.global.js.sri` holds its Subresource Integrity hash |

Everything is ESM, with CommonJS builds and TypeScript types included.

## Why "md-book"?

The bare npm name `md-book` was taken, so the package is published as
`@ibitsuki0296/md-book`. The project, repository and CLI are still called `md-book`.

## Development

```bash
npm install
npm test              # Vitest
npm run typecheck
npm run lint          # Biome
npm run build         # tsup + postbuild → dist/
npm run size          # bundle size budget
npm run validate:tokens
npm run example       # build and serve examples/docs at :4173
npm run playground    # theme playground at :4180
```

`examples/docs/` is both the development fixture and the demo site's content — md-book documents
itself. Releases use [Changesets](https://github.com/changesets/changesets): run `npx changeset`
for any user-facing change; CI publishes on merge to `main`.

## License

MIT © Hazuki ABE. The browser bundle includes third-party code; its licences are in
`dist/THIRD_PARTY_LICENSES.txt`, which is shipped with the package and with `md-book build` output.
