---
"@ibitsuki0296/md-book": minor
---

Add UI internationalisation for runtime-generated chrome. Ships `en` (default)
and `ja` string tables covering the pager, code-copy button, "skip to content",
blog list / pagination / taxonomy labels, the theme-toggle `aria-label`s and the
route error messages.

- `mount({ locale })` and `<md-book lang="ja">` select the locale (BCP-47 tags
  accepted; unknown values fall back to `en`). `mount({ strings })` takes
  per-string overrides.
- The resolved locale is written to `<html lang>` and emitted as `og:locale`.
- Blog post dates are now formatted with `Intl.DateTimeFormat` for the active
  locale (the `<time datetime>` attribute stays ISO). The taxonomy lead line no
  longer bolds the term name.
- New core exports: `resolveLocale`, `getStrings`, `createStrings`,
  `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, and the `Locale` / `UIStrings` types.
