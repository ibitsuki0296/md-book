import { slug as slugify } from 'github-slugger';
import {
  type BlogPost,
  collectPosts,
  findTaxonomy,
  groupByCategory,
  groupByTag,
  paginate,
} from '../core/blog.js';
import type { ManifestEntry } from '../core/content.js';

export interface BlogRuntimeConfig {
  dir: string;
  perPage: number;
  tagsBase: string;
  categoriesBase: string;
}

export const BLOG_DEFAULTS: BlogRuntimeConfig = {
  dir: 'blog',
  perPage: 10,
  tagsBase: '/tags',
  categoriesBase: '/categories',
};

export interface BlogView {
  title: string;
  html: string;
  /** Sidebar section to show alongside, or null for the whole tree. */
  section: string | null;
  /** True when a real Markdown page also lives at this route (render it first). */
  hasOwnPage: boolean;
}

interface HrefResolver {
  href(to: string): string;
}

/**
 * If `route` is a blog list / pagination / taxonomy route, returns the HTML to
 * render for it. Returns null for everything else so normal page loading runs.
 */
export function resolveBlogView(
  route: string,
  entries: ManifestEntry[],
  config: BlogRuntimeConfig,
  router: HrefResolver,
  hasOwnPage: boolean,
): BlogView | null {
  const posts = collectPosts(entries, { dir: config.dir, hideFuture: true });
  const blogRoot = `/${config.dir}`;

  // /blog  and  /blog/page/N
  if (route === blogRoot || route === `${blogRoot}/`) {
    return listView(posts, 1, config, blogRoot, router, hasOwnPage);
  }
  const pageMatch = route.match(new RegExp(`^${escapeRe(blogRoot)}/page/(\\d+)/?$`));
  if (pageMatch) {
    return listView(posts, Number(pageMatch[1]), config, blogRoot, router, false);
  }

  const tag = taxonomyRoute(route, config.tagsBase);
  if (tag !== null) {
    const groups = groupByTag(posts);
    return tag === ''
      ? taxonomyIndexView('Tags', groups, config.tagsBase, router)
      : taxonomyView('Tag', groups, tag, config.tagsBase, config, router);
  }

  const category = taxonomyRoute(route, config.categoriesBase);
  if (category !== null) {
    const groups = groupByCategory(posts);
    return category === ''
      ? taxonomyIndexView('Categories', groups, config.categoriesBase, router)
      : taxonomyView('Category', groups, category, config.categoriesBase, config, router);
  }

  return null;
}

function listView(
  posts: BlogPost[],
  pageNumber: number,
  config: BlogRuntimeConfig,
  blogRoot: string,
  router: HrefResolver,
  hasOwnPage: boolean,
): BlogView {
  const page = paginate(posts, config.perPage, pageNumber);
  const cards = page.items.map((post) => postCard(post, config, router)).join('\n');
  const pager = paginationNav(page.page, page.pageCount, blogRoot, router);
  const empty = page.total === 0 ? '<p class="md-book-blog__empty">No posts yet.</p>' : '';
  return {
    title: page.page > 1 ? `Blog — page ${page.page}` : 'Blog',
    html: `<div class="md-book-blog">${empty}${cards}${pager}</div>`,
    section: blogRoot,
    hasOwnPage: hasOwnPage && page.page === 1,
  };
}

function taxonomyView(
  kind: string,
  groups: ReturnType<typeof groupByTag>,
  slug: string,
  base: string,
  config: BlogRuntimeConfig,
  router: HrefResolver,
): BlogView {
  const group = findTaxonomy(groups, slug);
  if (!group) {
    return {
      title: `${kind}: ${slug}`,
      html: `<div class="md-book-blog"><p class="md-book-blog__empty">Nothing tagged “${esc(slug)}”.</p></div>`,
      section: null,
      hasOwnPage: false,
    };
  }
  const cards = group.posts.map((post) => postCard(post, config, router)).join('\n');
  return {
    title: `${kind}: ${group.name}`,
    html: `<div class="md-book-blog"><p class="md-book-blog__lead">${group.posts.length} post(s) tagged <strong>${esc(group.name)}</strong>. <a href="${attr(router.href(base))}">All ${kind.toLowerCase()}s</a></p>${cards}</div>`,
    section: null,
    hasOwnPage: false,
  };
}

function taxonomyIndexView(
  title: string,
  groups: ReturnType<typeof groupByTag>,
  base: string,
  router: HrefResolver,
): BlogView {
  const items = groups
    .map(
      (g) =>
        `<li><a href="${attr(router.href(`${base}/${g.slug}`))}">${esc(g.name)}</a> <span class="md-book-taxonomy__count">${g.posts.length}</span></li>`,
    )
    .join('');
  return {
    title,
    html: `<div class="md-book-blog"><ul class="md-book-taxonomy">${items || '<li>None yet.</li>'}</ul></div>`,
    section: null,
    hasOwnPage: false,
  };
}

function postCard(post: BlogPost, config: BlogRuntimeConfig, router: HrefResolver): string {
  const tags = post.tags
    .map(
      (t) =>
        `<a class="md-book-post__tag" href="${attr(router.href(`${config.tagsBase}/${slugify(t)}`))}">${esc(t)}</a>`,
    )
    .join(' ');
  const meta = [
    `<time datetime="${attr(post.dateISO)}">${esc(post.dateISO)}</time>`,
    post.author ? `<span>${esc(post.author)}</span>` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return [
    '<article class="md-book-post">',
    `<h2 class="md-book-post__title"><a href="${attr(router.href(post.path))}">${esc(post.title)}</a></h2>`,
    `<p class="md-book-post__meta">${meta}</p>`,
    post.summary ? `<p class="md-book-post__summary">${esc(post.summary)}</p>` : '',
    tags ? `<p class="md-book-post__tags">${tags}</p>` : '',
    '</article>',
  ]
    .filter(Boolean)
    .join('\n');
}

function paginationNav(
  page: number,
  pageCount: number,
  blogRoot: string,
  router: HrefResolver,
): string {
  if (pageCount <= 1) return '';
  const to = (n: number) =>
    n === 1 ? router.href(blogRoot) : router.href(`${blogRoot}/page/${n}`);
  const prev =
    page > 1
      ? `<a class="md-book-pagination__link" rel="prev" href="${attr(to(page - 1))}">← Newer</a>`
      : '<span></span>';
  const next =
    page < pageCount
      ? `<a class="md-book-pagination__link" rel="next" href="${attr(to(page + 1))}">Older →</a>`
      : '<span></span>';
  return `<nav class="md-book-pagination" aria-label="Blog pages">${prev}<span class="md-book-pagination__status">Page ${page} of ${pageCount}</span>${next}</nav>`;
}

function taxonomyRoute(route: string, base: string): string | null {
  const clean = route.replace(/\/+$/, '');
  if (clean === base) return '';
  return clean.startsWith(`${base}/`) ? clean.slice(base.length + 1) : null;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(value: string): string {
  return esc(value).replace(/"/g, '&quot;');
}
