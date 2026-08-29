---
title: Configuration
description: Every mount() option and <md-book> attribute.
---

# Configuration

## `<md-book>` attributes

| Attribute | Meaning |
| --- | --- |
| `manifest` | URL of `manifest.json` (default: next to the page) |
| `base` | Site base path, e.g. `/docs/` |
| `router` | `history` (default) or `hash` |
| `heading` | Site title for the header and `<title>` |
| `theme` | `light`, `dark`, or `system` (initial mode) |
| `blog` | Present ⇒ enable blog routes |
| `blog-dir` | Blog directory (default `blog`) |
| `blog-per-page` | Posts per list page (default `10`) |
| `site-url` | Absolute site URL for canonical / Open Graph links |

Children with `slot="navbar-end"`, `slot="sidebar-top"`, or `slot="page-footer"`
are lifted into those regions of the shell.

## `mount(target, options)`

```ts
import { mount } from '@ibitsuki0296/md-book/runtime';

await mount('#app', {
  manifestUrl: '/manifest.json',
  base: '/',
  routerMode: 'history',
  tocDepth: [2, 3],
  theme: { default: 'system', toggle: true },
  blog: { dir: 'blog', perPage: 10 },
  seo: { siteUrl: 'https://example.com/', siteName: 'My Docs', twitterSite: '@me' },
  highlight: (code, lang) => myHighlighter(code, lang),
});
```

`mount()` resolves once the first page has rendered and returns
`{ element, theme, navigate, destroy }`.

## Front matter

```yaml
---
title: Page title
description: Used for the excerpt and meta description
date: 2026-02-01        # makes a file a blog post
updated: 2026-02-10
tags: [guide, intro]
categories: [Handbook]
draft: true             # hidden from production builds
order: 2                # sidebar position within a directory
slug: custom-slug       # overrides the path-derived slug
cover: /img/cover.png
author: Your Name
---
```

## CLI

```bash
md-book manifest <contentDir> --base / --title "My Docs"
md-book feed <contentDir> --site-url https://example.com/ --formats rss,atom
md-book dev --root . --content ./content --port 4173
```
