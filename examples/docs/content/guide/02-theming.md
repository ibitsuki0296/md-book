---
title: Theming
description: Restyle the whole site by overriding CSS custom properties.
---

# Theming

md-book's public theming API is a set of namespaced CSS custom properties. A
theme is a single `.css` file that redefines them — load it **after**
`style.css`:

```html
<link rel="stylesheet" href="@md-book/core/style.css" />
<link rel="stylesheet" href="/my-theme.css" />
```

## The token contract

```css
:root {
  /* colour */
  --md-book-color-bg: #ffffff;
  --md-book-color-fg: #23272f;
  --md-book-color-fg-muted: #6b7280;
  --md-book-color-surface: #f7f8fa;
  --md-book-color-border: #dde0e7;
  --md-book-color-accent: #2563eb;
  --md-book-color-accent-fg: #ffffff;
  --md-book-color-code-bg: #eceef2;

  /* typography */
  --md-book-font-body: ui-sans-serif, system-ui, sans-serif;
  --md-book-font-mono: ui-monospace, Menlo, Consolas, monospace;
  --md-book-leading: 1.7;

  /* layout */
  --md-book-measure: 46rem;       /* reading width   */
  --md-book-sidebar-width: 16rem;
  --md-book-toc-width: 14rem;
  --md-book-radius: 0.5rem;
}
```

`themes/default.css` in the package lists every token with its default value —
copy it as a starting point. The primitive palette (`--md-book-gray-*`,
`--md-book-brand-*`) is also overridable if you want to recolour in one place.

## Dark mode

Provide a `[data-theme="dark"]` block. The runtime sets `data-theme` on `<html>`;
with no theme file, dark is also applied from `prefers-color-scheme`.

```css
:root[data-theme="dark"] {
  --md-book-color-bg: #14161b;
  --md-book-color-fg: #eceef2;
  --md-book-color-border: #363b48;
  --md-book-color-accent: #6ea8fe;
}
```

Paste `themeInitScript()` (or the equivalent inline snippet) into `<head>` so the
stored theme is applied before first paint.

## Structural overrides

The bundled rules live in `@layer md-book.tokens, .base, .layout, .content,
.components`. Any rule you add **without** a layer wins over all of them, so you
can restructure without specificity hacks:

```css
.md-book-header { position: static; }   /* beats the layered `position: sticky` */
```

:::warning
Don't hard-code colours in structural overrides — go through a token so light and
dark stay in sync. `npm run validate:tokens` enforces this on the bundled styles.
:::
