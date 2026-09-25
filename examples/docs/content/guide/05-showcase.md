---
title: Showcase
description: Every content component in one page — headings, callouts, tables and highlighted code.
---

# Showcase

A quick tour of the content components. Body text sits at a comfortable measure,
with [links](/guide/theming), `inline code` and **strong text** that stay legible
in light and dark.

## Callouts

:::note Note
Notes are for context the reader can skim past.
:::

:::tip Tip
Tips suggest a better way to do something.
:::

:::warning Heads up
Warnings flag things that can bite later.
:::

:::danger Careful
Danger is for destructive or irreversible actions.
:::

:::details Click to expand
Details render as a native disclosure — no JavaScript needed.
:::

## Tables

| Token | Purpose | Default |
|---|---|---|
| `--md-book-color-accent` | Links, focus ring, active states | `#4f46e5` |
| `--md-book-radius` | Cards, code blocks, callouts | `0.75rem` |
| `--md-book-measure` | Reading width | `46rem` |

## Code

### TypeScript

```ts
import { renderMarkdown } from '@ibitsuki0296/md-book';

interface Options {
  tocDepth?: [number, number];
}

/** Renders a page and returns its table of contents. */
export function toc(source: string, options: Options = {}) {
  const { toc, frontMatter } = renderMarkdown(source, options);
  console.log(`${frontMatter.title ?? 'Untitled'}: ${toc.length} sections`, 42, true);
  return toc; // done
}
```

### CSS

```css
@layer md-book.components {
  .md-book-container {
    padding: 0.9rem 1.1rem;
    border-radius: var(--md-book-radius);
    background: color-mix(in srgb, var(--_c) 8%, transparent);
  }
}
```

### Shell, JSON and YAML

```bash
# install and start the demo
npm install -D @ibitsuki0296/md-book
npx md-book manifest --root docs --out "$OUT_DIR"
```

```json
{
  "version": 1,
  "title": "My docs",
  "nav": [{ "text": "Guide", "link": "/guide/" }],
  "draft": false
}
```

```yaml
title: Showcase
tags: [design, tokens]
draft: false
order: 5
```

```diff
- --md-book-color-accent: #2563eb;
+ --md-book-color-accent: #4f46e5;
```

### HTML

```html
<md-book manifest="/manifest.json" lang="ja" blog></md-book>
```
