---
"@ibitsuki0296/md-book": patch
---

Update `js-yaml` to 5. Front matter keeps parsing `date: 2026-02-01` to a `Date` and resolving `<<` merge keys (js-yaml 5's default schema dropped both), and still rejects `!!js/*` tags.
