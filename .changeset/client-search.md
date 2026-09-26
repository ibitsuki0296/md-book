---
"@ibitsuki0296/md-book": minor
---

Add client-side full-text search.

- `md-book search-index <contentDir>` writes `search-index.json` (per page: title,
  headings, normalised plain text); `md-book dev` serves it live.
- `mount({ search: true })` / `<md-book search>` adds a header search box: a
  combobox with a live results list, highlighted snippets, arrow / Enter / Esc
  keys, and `/` or `Ctrl`/`⌘`+`K` to focus. The index is fetched on first input.
- The engine matches normalised substrings (AND over terms, title > heading > body
  ranking, NFKC width folding), so Japanese and other unspaced text works without a
  tokenizer, and it adds no dependency. Results follow the current locale.
- Core: `extractSearchDoc`, `createSearchIndex`, `createSearcher`, `assertSearchIndex`,
  `htmlToText`. Runtime: `createSearchBox`. New tokens-only styles and UI strings
  (`en` / `ja`).
