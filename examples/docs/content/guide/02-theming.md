---
title: Theming
description: Restyle the whole site by overriding CSS custom properties.
---

# Theming

md-book's public theming API is a set of namespaced CSS custom properties. A
theme is a single `.css` file that redefines them.

```css
:root {
  --md-book-color-accent: oklch(0.62 0.19 265);
  --md-book-font-body: "Inter", system-ui, sans-serif;
  --md-book-content-max: 46rem;
}

:root[data-theme="dark"] {
  --md-book-color-bg: oklch(0.19 0.02 265);
}
```

Because the bundled styles live in `@layer md-book.theme`, anything you load
afterwards wins without specificity battles.

:::warning
Do not hard-code colours in component overrides — go through a token so light
and dark stay in sync.
:::
