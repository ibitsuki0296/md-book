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

## Development

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # tsup -> dist/ (ESM + CJS + d.ts)
npm run lint      # biome
```

## Roadmap

See [`plans/…dynamic-hinton.md`](../../.claude/plans/javascript-markdown-dynamic-hinton.md)
for the full requirements doc. Milestones:

| | |
|---|---|
| **M1 core** *(done)* | Markdown pipeline, front matter, TOC, link rewrite, containers |
| M2 | Content model: manifest type, route resolution, nav/sidebar, `md-book manifest` + dev server |
| M3 | Runtime UI: `<md-book>` element / `mount()`, client router, layout, scroll-spy, code copy |
| M4 | Theming: token CSS + `@layer`, light/dark, `setTheme`, FOUC guard, token validator |
| M5 | Blog: post collection, pagination, tag/category pages, RSS/Atom/JSON feed |
| M6 | a11y, size budget, SEO meta, demo site, docs, distribution (ESM/CJS/UMD/CSS), first release |

## License

MIT © Hazuki Abe
