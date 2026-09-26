---
"@ibitsuki0296/md-book": minor
---

Add a static-build (SSG) mode: `md-book build`.

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
