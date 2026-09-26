/**
 * The app shell (header, nav, sidebar, article, pager, TOC) as an HTML string,
 * for static pre-rendering. It mirrors the DOM `runtime/app.ts` builds — same
 * elements, classes and ARIA — so a pre-rendered page and the mounted app look
 * identical and the runtime can take over without a visual jump. A parity test
 * (`test/shell.test.ts`) keeps the two in step. Pure and DOM-free.
 */
import type { NavItem, PrevNext, RouteNode } from './content.js';
import { escapeAttr as attr, escapeText as esc } from './head.js';
import type { UIStrings } from './i18n.js';
import type { LocaleConfig } from './locale.js';
import type { TocEntry } from './types.js';

export interface ShellPage {
  contentHTML: string;
  sidebar: RouteNode[];
  toc: TocEntry[];
  prevNext: PrevNext;
  /** Front-matter `layout`; `home` switches to the full-width landing layout. */
  layout?: string;
  /** Front-matter `writing`; `vertical` switches the article to 縦書き. */
  writing?: string;
}

export interface ShellInput {
  site: { title: string };
  strings: UIStrings;
  /** Route path → `href` (adds the site base). */
  href: (route: string) => string;
  /** Route the brand links to. Default `/`. */
  home?: string;
  nav: NavItem[];
  /** Route path of the page being rendered. */
  path: string;
  page: ShellPage;
  /** Adds the language switcher to the header when the site is localised. */
  languages?: { locales: LocaleConfig[]; current: string };
}

const CONTENT_ID = 'md-book-content';
const SIDEBAR_ID = 'md-book-sidebar';

export function renderShell(input: ShellInput): string {
  const { strings: t, page, href } = input;
  const home = page.layout === 'home';
  const vertical = page.writing === 'vertical';
  const rootClass = ['md-book', vertical ? 'md-book--vertical' : '', home ? 'md-book--home' : '']
    .filter(Boolean)
    .join(' ');
  const menuHidden = home || page.sidebar.length === 0;

  const navLinks = input.nav
    .map((item) => {
      const active = isActive(item.link, input.path);
      return `<a class="md-book-nav__link${active ? ' is-active' : ''}" href="${attr(href(item.link))}"${active ? ' aria-current="page"' : ''}>${esc(item.text)}</a>`;
    })
    .join('');

  const navbarEnd = input.languages
    ? `<div class="md-book-navbar-end">${languageSwitcher(input.languages, t)}</div>`
    : '<div class="md-book-navbar-end" hidden></div>';

  const header = [
    '<header class="md-book-header">',
    `<button class="md-book-menu-toggle" type="button" aria-label="${attr(t.menuLabel)}" aria-expanded="false" aria-controls="${SIDEBAR_ID}"${menuHidden ? ' hidden' : ''}></button>`,
    `<a class="md-book-brand" href="${attr(href(input.home ?? '/'))}">${esc(input.site.title)}</a>`,
    `<nav class="md-book-nav" aria-label="${attr(t.mainNavLabel)}">${navLinks}</nav>`,
    '<div class="md-book-navbar-search" hidden></div>',
    navbarEnd,
    '</header>',
  ].join('');

  const sidebar = [
    `<aside class="md-book-sidebar" id="${SIDEBAR_ID}">`,
    '<div class="md-book-sidebar__top" hidden></div>',
    `<nav class="md-book-sidebar__nav" aria-label="${attr(t.sidebarLabel)}">${sidebarList(page.sidebar, href, input.path)}</nav>`,
    '</aside>',
  ].join('');

  const main = [
    `<main class="md-book-main" id="${CONTENT_ID}" tabindex="-1">`,
    `<article class="md-book-article${vertical ? ' md-book-article--vertical' : ''}">${page.contentHTML}</article>`,
    `<nav class="md-book-pager" aria-label="${attr(t.pageNavLabel)}">${pager(page.prevNext, href, t)}</nav>`,
    '<footer class="md-book-page-footer" hidden></footer>',
    '</main>',
  ].join('');

  const toc = `<nav class="md-book-toc" aria-label="${attr(t.onThisPageLabel)}"${page.toc.length === 0 ? ' hidden' : ''}>${tocList(page.toc, href, input.path, t)}</nav>`;

  return [
    `<div class="${rootClass}">`,
    `<a class="md-book-skip" href="#${CONTENT_ID}">${esc(t.skipToContent)}</a>`,
    header,
    '<div class="md-book-backdrop" aria-hidden="true"></div>',
    `<div class="md-book-body">${sidebar}${main}${toc}</div>`,
    '</div>',
  ].join('');
}

function isActive(link: string, current: string): boolean {
  return link === current || (current !== '/' && link !== '/' && current.startsWith(`${link}/`));
}

function sidebarList(nodes: RouteNode[], href: (r: string) => string, current: string): string {
  const items = nodes.map((node) => {
    let inner: string;
    if (node.entry) {
      const isCurrent = node.entry.path === current;
      inner = `<a class="md-book-sidebar__link" href="${attr(href(node.entry.path))}"${isCurrent ? ' aria-current="page"' : ''}>${esc(node.title)}</a>`;
    } else {
      inner = `<span class="md-book-sidebar__group">${esc(node.title)}</span>`;
    }
    if (node.children.length > 0) inner += sidebarList(node.children, href, current);
    return `<li class="md-book-sidebar__item">${inner}</li>`;
  });
  return `<ul class="md-book-sidebar__list">${items.join('')}</ul>`;
}

function tocList(
  entries: TocEntry[],
  href: (r: string) => string,
  current: string,
  t: UIStrings,
): string {
  if (entries.length === 0) return '';
  const build = (list: TocEntry[]): string =>
    `<ul class="md-book-toc__list">${list
      .map(
        (entry) =>
          `<li class="md-book-toc__item"><a class="md-book-toc__link" href="${attr(`${href(current)}#${entry.id}`)}" data-id="${attr(entry.id)}">${esc(entry.text)}</a>${entry.children.length > 0 ? build(entry.children) : ''}</li>`,
      )
      .join('')}</ul>`;
  return `<p class="md-book-toc__title">${esc(t.onThisPageLabel)}</p>${build(entries)}`;
}

function pager(prevNext: PrevNext, href: (r: string) => string, t: UIStrings): string {
  const link = (dir: 'prev' | 'next', label: string, target: { path: string; title: string }) =>
    `<a class="md-book-pager__link md-book-pager__link--${dir}" href="${attr(href(target.path))}"><span class="md-book-pager__dir">${esc(label)}</span><span class="md-book-pager__title">${esc(target.title)}</span></a>`;
  return [
    prevNext.prev ? link('prev', t.previous, prevNext.prev) : '',
    prevNext.next ? link('next', t.next, prevNext.next) : '',
  ].join('');
}

function languageSwitcher(
  languages: { locales: LocaleConfig[]; current: string },
  t: UIStrings,
): string {
  const options = languages.locales
    .map(
      (l) =>
        `<option value="${attr(l.code)}" lang="${attr(l.code)}"${l.code === languages.current ? ' selected' : ''}>${esc(l.label ?? l.code)}</option>`,
    )
    .join('');
  return `<div class="md-book-lang"><select class="md-book-lang__select" aria-label="${attr(t.languageLabel)}">${options}</select></div>`;
}
