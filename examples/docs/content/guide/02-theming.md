---
title: Theming
description: Restyle the whole site by overriding CSS custom properties.
---

# Theming

md-book's public theming API is a set of namespaced CSS custom properties. A
theme is a single `.css` file that redefines them — load it **after**
`style.css`:

```html
<link rel="stylesheet" href="@ibitsuki0296/md-book/style.css" />
<link rel="stylesheet" href="/my-theme.css" />
```

## The token contract

```css
:root {
  /* colour */
  --md-book-color-bg: #ffffff;
  --md-book-color-fg: #18181c;
  --md-book-color-fg-muted: #6f6f7b;
  --md-book-color-surface: #fafafa;
  --md-book-color-border: #e7e7ea;
  --md-book-color-accent: #4f46e5;
  --md-book-color-accent-fg: #ffffff;
  --md-book-color-code-bg: #fafafa;

  /* syntax highlighting */
  --md-book-color-tok-keyword: #7c3aed;
  --md-book-color-tok-string: #047857;
  --md-book-color-tok-function: #2563eb;

  /* typography */
  --md-book-font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --md-book-font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  --md-book-leading: 1.7;

  /* layout */
  --md-book-measure: 46rem;       /* reading width   */
  --md-book-sidebar-width: 16rem;
  --md-book-toc-width: 14rem;
  --md-book-radius: 0.75rem;
}
```

`themes/default.css` in the package lists every token with its default value —
copy it as a starting point. The primitive palette (`--md-book-gray-*`,
`--md-book-brand-*`) is also overridable if you want to recolour in one place.

## Fonts

md-book never downloads fonts itself. The default stacks list **Inter** and
**JetBrains Mono** first, so loading them (a `<link>` to Google Fonts, or
self-hosted `@font-face`) is enough; without them the platform UI font is used.

## Syntax highlighting

Fenced code in `js`/`ts`, `json`, `css`, `html`, `bash`, `yaml`, `python` and
`diff` is highlighted at render time by a tiny built-in tokenizer, coloured with
the `--md-book-color-tok-*` tokens. Other languages stay plain. For full-grammar
highlighting pass `highlight: (code, lang) => html` to `mount()` (Shiki,
highlight.js, …), or set `highlight: false` on `renderMarkdown()` to switch the
built-in one off.

## Dark mode

Provide a `[data-theme="dark"]` block. The runtime sets `data-theme` on `<html>`;
with no theme file, dark is also applied from `prefers-color-scheme`.

```css
:root[data-theme="dark"] {
  --md-book-color-bg: #0a0a0d;
  --md-book-color-fg: #f4f4f5;
  --md-book-color-border: #26262d;
  --md-book-color-accent: #818cf8;
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
