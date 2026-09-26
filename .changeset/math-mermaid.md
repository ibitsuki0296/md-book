---
"@ibitsuki0296/md-book": minor
---

Add KaTeX math and Mermaid diagrams (opt-in, lazy-loaded).

- `math`: `$inline$` and `$$display$$` (single- or multi-line) with Pandoc-style
  delimiting so prose such as "costs $5 and $10" is untouched. TeX is emitted
  escaped in `.md-book-math` elements; `RenderOptions.math` also accepts
  `{ render }` to typeset at render time (used by `md-book build --math` when
  `katex` is installed).
- `mermaid`: ```` ```mermaid ```` fences become `<pre class="md-book-mermaid">`;
  drawn with `securityLevel: 'strict'` and redrawn on light/dark changes.
- Enable in the runtime with `mount({ math, mermaid })` or `<md-book math mermaid>`.
  KaTeX / Mermaid load from jsDelivr on the first page that needs them, or from your
  own `load: () => import('katex')`; nothing is added to the bundle.
