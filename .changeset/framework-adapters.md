---
"@ibitsuki0296/md-book": minor
---

Add Vite, Astro and Next.js adapters.

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
