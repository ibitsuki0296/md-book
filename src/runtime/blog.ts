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
import type { UIStrings } from '../core/i18n.js';

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

/** Locale-aware bits threaded through the blog views. */
export interface BlogI18n {
  strings: UIStrings;
  /** BCP-47 tag for `Intl.DateTimeFormat` (post dates). */
  locale: string;
}

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
  i18n: BlogI18n,
): BlogView | null {
  const posts = collectPosts(entries, { dir: config.dir, hideFuture: true });
  const blogRoot = `/${config.dir}`;
  const { strings } = i18n;

  // /blog  and  /blog/page/N
  if (route === blogRoot || route === `${blogRoot}/`) {
    return listView(posts, 1, config, blogRoot, router, hasOwnPage, i18n);
  }
  const pageMatch = route.match(new RegExp(`^${escapeRe(blogRoot)}/page/(\\d+)/?$`));
  if (pageMatch) {
    return listView(posts, Number(pageMatch[1]), config, blogRoot, router, false, i18n);
  }

  const tag = taxonomyRoute(route, config.tagsBase);
  if (tag !== null) {
    const groups = groupByTag(posts);
    return tag === ''
      ? taxonomyIndexView(strings.tagsIndexTitle, groups, config.tagsBase, router, strings)
      : taxonomyView(strings.tagKind, groups, tag, config.tagsBase, config, router, i18n);
  }

  const category = taxonomyRoute(route, config.categoriesBase);
  if (category !== null) {
    const groups = groupByCategory(posts);
    return category === ''
      ? taxonomyIndexView(
          strings.categoriesIndexTitle,
          groups,
          config.categoriesBase,
          router,
          strings,
        )
      : taxonomyView(
          strings.categoryKind,
          groups,
          category,
          config.categoriesBase,
          config,
          router,
          i18n,
        );
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
  i18n: BlogI18n,
): BlogView {
  const page = paginate(posts, config.perPage, pageNumber);
  const cards = page.items.map((post) => postCard(post, config, router, i18n)).join('\n');
  const pager = paginationNav(page.page, page.pageCount, blogRoot, router, i18n);
  const empty =
    page.total === 0 ? `<p class="md-book-blog__empty">${esc(i18n.strings.noPostsYet)}</p>` : '';
  return {
    title: page.page > 1 ? i18n.strings.blogListPageTitle(page.page) : i18n.strings.blog,
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
  i18n: BlogI18n,
): BlogView {
  const { strings } = i18n;
  const group = findTaxonomy(groups, slug);
  if (!group) {
    return {
      title: strings.taxonomyPageTitle(kind, slug),
      html: `<div class="md-book-blog"><p class="md-book-blog__empty">${esc(strings.nothingTaggedWith(slug))}</p></div>`,
      section: null,
      hasOwnPage: false,
    };
  }
  const cards = group.posts.map((post) => postCard(post, config, router, i18n)).join('\n');
  const lead = `${esc(strings.taxonomyLead(group.posts.length, group.name))} <a href="${attr(router.href(base))}">${esc(strings.allOfKind(kind))}</a>`;
  return {
    title: strings.taxonomyPageTitle(kind, group.name),
    html: `<div class="md-book-blog"><p class="md-book-blog__lead">${lead}</p>${cards}</div>`,
    section: null,
    hasOwnPage: false,
  };
}

function taxonomyIndexView(
  title: string,
  groups: ReturnType<typeof groupByTag>,
  base: string,
  router: HrefResolver,
  strings: UIStrings,
): BlogView {
  const items = groups
    .map(
      (g) =>
        `<li><a href="${attr(router.href(`${base}/${g.slug}`))}">${esc(g.name)}</a> <span class="md-book-taxonomy__count">${g.posts.length}</span></li>`,
    )
    .join('');
  return {
    title,
    html: `<div class="md-book-blog"><ul class="md-book-taxonomy">${items || `<li>${esc(strings.noneYet)}</li>`}</ul></div>`,
    section: null,
    hasOwnPage: false,
  };
}

function postCard(
  post: BlogPost,
  config: BlogRuntimeConfig,
  router: HrefResolver,
  i18n: BlogI18n,
): string {
  const tags = post.tags
    .map(
      (t) =>
        `<a class="md-book-post__tag" href="${attr(router.href(`${config.tagsBase}/${slugify(t)}`))}">${esc(t)}</a>`,
    )
    .join(' ');
  const meta = [
    `<time datetime="${attr(post.dateISO)}">${esc(formatDate(post.date, i18n.locale))}</time>`,
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
  i18n: BlogI18n,
): string {
  if (pageCount <= 1) return '';
  const { strings } = i18n;
  const to = (n: number) =>
    n === 1 ? router.href(blogRoot) : router.href(`${blogRoot}/page/${n}`);
  const prev =
    page > 1
      ? `<a class="md-book-pagination__link" rel="prev" href="${attr(to(page - 1))}">${esc(strings.newer)}</a>`
      : '<span></span>';
  const next =
    page < pageCount
      ? `<a class="md-book-pagination__link" rel="next" href="${attr(to(page + 1))}">${esc(strings.older)}</a>`
      : '<span></span>';
  return `<nav class="md-book-pagination" aria-label="${attr(strings.blogPagesLabel)}">${prev}<span class="md-book-pagination__status">${esc(strings.paginationStatus(page, pageCount))}</span>${next}</nav>`;
}

function formatDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
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
