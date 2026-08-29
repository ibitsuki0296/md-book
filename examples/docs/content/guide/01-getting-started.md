---
title: Getting started
description: Install md-book and render your first page.
---

# Getting started

## Install

```bash
npm install @ibitsuki0296/md-book
```

## Generate a manifest

md-book needs a list of your Markdown files, because a browser cannot read a
directory on its own:

```bash
npx md-book manifest ./content --base /
```

This writes `content/manifest.json`. Commit it, or regenerate it in CI.

## Render a page

```ts
import { renderMarkdown } from '@ibitsuki0296/md-book';

const { html, toc, frontMatter } = renderMarkdown(source, {
  linkRewrite: { currentPath: '/guide/getting-started' },
});
```

See [Theming](./theming.md) for how to restyle everything with CSS tokens.
