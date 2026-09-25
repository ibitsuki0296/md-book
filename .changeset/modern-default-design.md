---
"@ibitsuki0296/md-book": minor
---

Modernise the default design and add built-in syntax highlighting.

- Refreshed default theme: neutral zinc palette with an indigo accent, softer
  borders, larger radii (`--md-book-radius` 0.75rem, `--md-book-radius-sm`
  0.375rem), tighter heading type, no more `h2` underline. Token names are
  unchanged; only default values moved, so custom themes keep working.
- Callouts are rounded cards with a glyph badge; tables are bordered cards with
  row dividers; code blocks get a border, a language label and a hover copy
  button (always visible on touch devices).
- Fenced code is highlighted at render time (js/ts, json, css, html, bash, yaml,
  python, diff) with a tiny built-in tokenizer. New tokens:
  `--md-book-color-tok-{comment,keyword,string,number,function,type,attr}`.
  New core export `highlightCode`, and a `highlight` render option
  (default `true`). `mount({ highlight })` still overrides it.
- Refreshed chrome: pill-style nav and sidebar states, a titled TOC rail with
  aligned nesting, card-style pager and blog posts, a hairline sticky header.
- On narrow screens (<= 760px) the sidebar is now an off-canvas drawer opened by
  a header menu button (Escape / backdrop / link click close it). New UI string
  `menuLabel` (en: "Menu", ja: "メニュー").
- The TOC rail now shows an "On this page" title (`.md-book-toc__title`).
- Default font stacks now prefer Inter and JetBrains Mono when available (they
  are not downloaded automatically).
- New `layout: home` landing page: front-matter `hero` (name, text, tagline,
  actions) and `features` render as a hero and feature cards on a full-width
  layout. New core export `renderHome` and `HomeHero` / `HomeAction` /
  `HomeFeature` types.
- Sidebar siblings without an explicit `order` now sort by `date` (newest first)
  before title, so the blog section is listed in date order.

