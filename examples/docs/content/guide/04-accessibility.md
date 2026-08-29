---
title: Accessibility
description: What md-book handles, and what stays your responsibility.
---

# Accessibility

md-book aims for WCAG 2.1 AA out of the box.

## Built in

- Landmark structure: `<header>`, `<nav>` (labelled), `<main>`, `<aside>`,
  `<footer>`, plus a **Skip to content** link.
- Focus moves to `<main>` on every client-side navigation, and the page scrolls
  to the top (or the `#hash` target).
- The sidebar marks the current page with `aria-current="page"`; the TOC marks
  the active heading with `aria-current="true"`.
- The theme toggle is a real `<button>` with an `aria-label` and `aria-pressed`.
- `prefers-reduced-motion` disables transitions.
- Bundled themes meet AA contrast in light and dark.

## Your responsibility

- Give every image meaningful `alt` text in your Markdown.
- Keep heading levels sequential (don't jump from `##` to `####`).
- If you supply a custom theme, re-check contrast for both modes.
- If you enable raw HTML (`allowHtml`), you own its accessibility and safety.

## Testing

Run [axe](https://github.com/dequelabs/axe-core) against a built page, and tab
through the site: every interactive element should have a visible focus ring
(md-book uses `:focus-visible`).
