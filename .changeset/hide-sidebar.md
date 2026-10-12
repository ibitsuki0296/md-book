---
"@ibitsuki0296/md-book": minor
---

The sidebar can now be hidden. Set `sidebar: false` in a page's front matter to drop it on that page, or `blog: { sidebar: false }` (`<md-book blog-sidebar="false">`, `md-book build --blog-no-sidebar`) to drop it on every blog route — the list, tag / category pages and posts. The article and its table of contents stay, and the mobile menu button is hidden along with the sidebar.
