# md-book theme playground

An interactive editor for the `--md-book-*` token contract. Tweak colours,
typography, and layout on the left; a real `<md-book>` site re-styles live on the
right; copy or download the result as a drop-in theme stylesheet.

## Run it

```bash
npm run playground
```

This builds the bundle, copies `md-book.global.js` + `style.css` into this folder
(both gitignored), and serves the playground at <http://localhost:4180> with the
`examples/docs` content as the preview site.

## How it works

| File | Role |
|---|---|
| `index.html` | Editor shell — control panel + preview `<iframe>` |
| `playground.css` | Chrome for the editor only (its own `--pg-*` vars — never `--md-book-*`) |
| `tokens.js` | The token schema: fields, defaults for light **and** dark, presets, mirrors `src/styles/tokens.css` |
| `playground.js` | Builds the controls, keeps state (persisted to `localStorage`), synthesises the CSS |
| `preview.html` | The `<iframe>` document — mounts `<md-book>` (hash router) and applies overrides sent via `postMessage` |

The editor sends the preview a full unlayered stylesheet plus the mode to force
(`data-theme`). Because it is unlayered it always beats `@layer md-book.tokens`,
and a `MutationObserver` in the preview keeps `data-theme` pinned so the md-book
runtime's own theme controller can't fight it.

Light and dark are edited independently: the **Light / Dark** toggle switches
which set of per-mode values (surfaces, accent overrides, admonitions) the
controls bind to and forces the preview to that mode. Typography and layout are
mode-independent, matching `tokens.css`.

## Export

The generated CSS mirrors the reference themes in `src/styles/themes/`: a `:root`
block, a `:root[data-theme="dark"]` block, and (optionally) a
`@media (prefers-color-scheme: dark)` block so the theme also follows the OS with
no explicit toggle. Load it **after** md-book's `style.css`.

> Keep `tokens.js` in sync when `src/styles/tokens.css` changes.
