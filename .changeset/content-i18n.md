---
"@ibitsuki0296/md-book": minor
---

Add content-level i18n (locale routing).

- The default locale lives at the content root, other locales under `/<code>/`
  (`ja/guide/intro.md` → `/ja/guide/intro`). Declare them with
  `md-book manifest --locales en,ja` (also `dev`, `build`, `search-index`, and the
  adapters), `mount({ locales })`, or the manifest's new `locales` /
  `defaultLocale` fields (entries get `locale`).
- The runtime follows the route's locale: UI strings, `<html lang>` and `og:locale`,
  per-locale site title, nav, sidebar, prev/next, blog routes (`/ja/blog`,
  `/ja/tags`) and search scope. A language switcher jumps to the same page in
  another locale (or that locale's home), and translated pages emit
  `<link rel="alternate" hreflang>` incl. `x-default`.
- Core helpers: `normalizeLocales`, `localeOfRoute`, `localizeRoute`, `stripLocale`,
  `entriesForLocale`, `alternatesOf`, `createSiteModel`; `buildNav` gains
  `{ section }`.
