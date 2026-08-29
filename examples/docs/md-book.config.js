// Example site configuration. The runtime (M3) will consume this shape;
// for now the dev server only needs `contentDir` and `base`.
export default {
  title: 'md-book example',
  description: 'A runtime-first Markdown documentation and blog library.',
  lang: 'en',
  base: '/',
  contentDir: './content',
  nav: 'auto',
  sidebar: 'auto',
  blog: {
    dir: 'blog',
    permalink: '/blog/:slug',
    perPage: 10,
    feed: { types: ['rss', 'atom'] },
  },
  theme: {
    default: 'light',
    switcher: true,
  },
};
