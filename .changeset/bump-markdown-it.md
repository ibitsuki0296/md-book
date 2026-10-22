---
"@ibitsuki0296/md-book": patch
---

Update the bundled `markdown-it` to 14.3.3, which fixes three quadratic-time denial-of-service issues (smartquotes, link reference definitions, inline HTML with `allowHtml`). The dependency range is now `^14.3.3`, so installs can no longer resolve a vulnerable version, and the CDN bundle (`md-book.global.js`) ships the fixed one.
