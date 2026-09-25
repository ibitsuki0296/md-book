---
"@ibitsuki0296/md-book": minor
---

Add vertical writing (縦書き) for publishing tanka and other Japanese text.

- Front-matter `writing: vertical` sets the article in vertical-rl: fixed-height,
  right-to-left columns that scroll sideways (the mouse wheel is mapped to it).
  `FrontMatter.writing` is typed; the app root gets `md-book--vertical` and the
  article `md-book-article--vertical`.
- New `:::tanka` container: a poem block that keeps source line breaks.
- New `:::vertical` container and a `.vertical` modifier for any container
  (`:::tanka.vertical 題`) set a single block in vertical writing inside a
  horizontal page (fixed-height, sideways scroll when it overflows).
- New ruby (ふりがな) syntax `{漢字|かんじ}` →
  `<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>`; both parts are escaped,
  heading ids / excerpts use the base text. Opt out with `ruby: false`
  (new `RenderOptions.ruby`).
- New tokens `--md-book-font-serif` (mincho stack) and
  `--md-book-vertical-height`.
