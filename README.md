# @md-book/core

Runtime-first Markdown **documentation & blog** library with token-based theming.

Write content in Markdown, drop in a `manifest.json`, and render a full docs/blog
site in the browser — no build step required. A static-site (SSG) mode and
framework adapters come later; the core is deliberately pure so both layers can
share it.

> **Status: early development.** The `core` rendering layer (this milestone) is
> implemented and tested. Runtime UI, theming, blog features, and the CLI are on
> the roadmap below.

## Why "md-book"

The bare npm name `md-book` was taken, so the package publishes as
`@md-book/core`. The project, repo, and CLI keep the name `md-book`.

## Install

```bash
npm install @md-book/core
```

## Core API (implemented now)

`renderMarkdown()` turns a Markdown document into HTML plus the structured
metadata the runtime and SSG layers need. It never touches the DOM or the
filesystem.

```ts
import { renderMarkdown } from '@md-book/core';

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

## Development

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # tsup -> dist/ (ESM + CJS + d.ts + CLI)
npm run lint      # biome
```

The example site under `examples/docs/` is the fixture for the dev server and
integration tests.

## Roadmap

See [`plans/…dynamic-hinton.md`](../../.claude/plans/javascript-markdown-dynamic-hinton.md)
for the full requirements doc. Milestones:

| | |
|---|---|
| **M1 core** *(done)* | Markdown pipeline, front matter, TOC, link rewrite, containers |
| **M2 content model** *(done)* | Manifest type + validation, route resolution, nav/sidebar, prev/next, `md-book manifest` + `md-book dev` |
| M3 | Runtime UI: `<md-book>` element / `mount()`, client router, layout, scroll-spy, code copy |
| M4 | Theming: token CSS + `@layer`, light/dark, `setTheme`, FOUC guard, token validator |
| M5 | Blog: post collection, pagination, tag/category pages, RSS/Atom/JSON feed |
| M6 | a11y, size budget, SEO meta, demo site, docs, distribution (ESM/CJS/UMD/CSS), first release |

## License

MIT © Hazuki Abe
