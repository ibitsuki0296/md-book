---
"@ibitsuki0296/md-book": minor
---

Statically built pages are now adopted by the runtime instead of being wiped and re-rendered: the pre-rendered DOM stays on screen, so there is no blank article, layout shift or second fetch on load. `md-book build` stamps `data-prerendered` on `<md-book>`; the runtime reuses the markup only when it matches the current route, otherwise it renders as before. The page-footer slot is also kept hidden until the first page has rendered.
