import type { NavItem, PrevNext, RouteNode } from '../core/content.js';
import type { UIStrings } from '../core/i18n.js';
import type { TocEntry } from '../core/types.js';
import { h, replaceChildren } from './dom.js';
import { enableVerticalWheelScroll } from './enhance.js';
import type { Router } from './router.js';

export interface AppSite {
  title: string;
  description?: string;
}

export type SlotContent = string | Node;

export interface AppOptions {
  site: AppSite;
  router: Router;
  strings: UIStrings;
  slots?: Partial<Record<'navbarEnd' | 'sidebarTop' | 'pageFooter', SlotContent>>;
}

export interface PageState {
  path: string;
  title: string;
  contentHTML: string;
  sidebar: RouteNode[];
  toc: TocEntry[];
  prevNext: PrevNext;
  /** Front-matter `layout`; `home` switches to the full-width landing layout. */
  layout?: string;
  /** Front-matter `writing`; `vertical` switches the article to 縦書き. */
  writing?: string;
}

export interface App {
  readonly root: HTMLElement;
  readonly content: HTMLElement;
  readonly article: HTMLElement;
  /** The header's trailing region — mount appends the theme toggle here. */
  readonly navbarEnd: HTMLElement;
  renderNav(nav: NavItem[]): void;
  renderPage(state: PageState): void;
  renderMessage(title: string, body: string): void;
  setActiveHeading(id: string | null): void;
  focusContent(): void;
}

const CONTENT_ID = 'md-book-content';
const SIDEBAR_ID = 'md-book-sidebar';

/** Builds the app shell once; subsequent calls update regions in place. */
export function createApp(target: HTMLElement, options: AppOptions): App {
  const { router, strings } = options;

  const brand = h('a', { class: 'md-book-brand', href: router.href('/') }, options.site.title);
  const nav = h('nav', { class: 'md-book-nav', aria: { label: strings.mainNavLabel } });
  const navbarEnd = h('div', { class: 'md-book-navbar-end' });
  applySlot(navbarEnd, options.slots?.navbarEnd);

  // Below the tablet breakpoint the sidebar is an off-canvas drawer (see layout.css).
  const menuButton = h('button', {
    class: 'md-book-menu-toggle',
    type: 'button',
    aria: { label: strings.menuLabel, expanded: 'false', controls: SIDEBAR_ID },
  });
  const header = h('header', { class: 'md-book-header' }, menuButton, brand, nav, navbarEnd);

  const sidebarTop = h('div', { class: 'md-book-sidebar__top' });
  applySlot(sidebarTop, options.slots?.sidebarTop);
  const sidebarNav = h('nav', {
    class: 'md-book-sidebar__nav',
    aria: { label: strings.sidebarLabel },
  });
  const sidebar = h('aside', { class: 'md-book-sidebar', id: SIDEBAR_ID }, sidebarTop, sidebarNav);

  const article = h('article', { class: 'md-book-article' });
  enableVerticalWheelScroll(article);
  const pager = h('nav', { class: 'md-book-pager', aria: { label: strings.pageNavLabel } });
  const pageFooter = h('footer', { class: 'md-book-page-footer' });
  applySlot(pageFooter, options.slots?.pageFooter);
  const content = h(
    'main',
    { class: 'md-book-main', id: CONTENT_ID, tabindex: '-1' },
    article,
    pager,
    pageFooter,
  );

  const tocNav = h('nav', { class: 'md-book-toc', aria: { label: strings.onThisPageLabel } });

  const body = h('div', { class: 'md-book-body' }, sidebar, content, tocNav);
  const backdrop = h('div', { class: 'md-book-backdrop', aria: { hidden: 'true' } });
  const root = h(
    'div',
    { class: 'md-book' },
    h('a', { class: 'md-book-skip', href: `#${CONTENT_ID}` }, strings.skipToContent),
    header,
    backdrop,
    body,
  );

  target.replaceChildren(root);

  const setMenu = (open: boolean, moveFocus = true) => {
    if (root.classList.contains('is-menu-open') === open) return;
    root.classList.toggle('is-menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    if (!moveFocus) return;
    if (open) sidebar.querySelector<HTMLElement>('a')?.focus();
    else menuButton.focus();
  };
  menuButton.addEventListener('click', () => setMenu(!root.classList.contains('is-menu-open')));
  backdrop.addEventListener('click', () => setMenu(false, false));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });
  sidebar.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) setMenu(false, false);
  });

  const renderNav = (items: NavItem[]) => {
    replaceChildren(
      nav,
      ...items.map((item) =>
        h('a', { class: 'md-book-nav__link', href: router.href(item.link) }, item.text),
      ),
    );
    highlightCurrent(nav, router.current);
  };

  const setVertical = (vertical: boolean) => {
    root.classList.toggle('md-book--vertical', vertical);
    article.classList.toggle('md-book-article--vertical', vertical);
    article.scrollLeft = 0; // vertical-rl starts at the right edge (= the start of the text)
  };

  const renderPage = (state: PageState) => {
    article.innerHTML = state.contentHTML;
    setVertical(state.writing === 'vertical');
    replaceChildren(sidebarNav, renderSidebar(state.sidebar, router, state.path));
    replaceChildren(tocNav, ...renderToc(state.toc, router, strings));
    tocNav.hidden = state.toc.length === 0;
    const home = state.layout === 'home';
    root.classList.toggle('md-book--home', home);
    menuButton.hidden = home || state.sidebar.length === 0;
    setMenu(false, false);
    replaceChildren(pager, ...renderPager(state.prevNext, router, strings));
    highlightCurrent(nav, router.current);
  };

  const renderMessage = (title: string, bodyText: string) => {
    root.classList.remove('md-book--home');
    setVertical(false);
    article.replaceChildren(h('h1', {}, title), h('p', {}, bodyText));
    replaceChildren(pager);
    tocNav.hidden = true;
  };

  const setActiveHeading = (id: string | null) => {
    for (const link of tocNav.querySelectorAll<HTMLAnchorElement>('a[data-id]')) {
      link.classList.toggle('is-active', link.dataset.id === id);
      if (link.dataset.id === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };

  return {
    root,
    content,
    article,
    navbarEnd,
    renderNav,
    renderPage,
    renderMessage,
    setActiveHeading,
    focusContent: () => content.focus({ preventScroll: true }),
  };
}

function renderSidebar(nodes: RouteNode[], router: Router, currentPath: string): HTMLElement {
  const list = h('ul', { class: 'md-book-sidebar__list' });
  for (const node of nodes) {
    const item = h('li', { class: 'md-book-sidebar__item' });
    if (node.entry) {
      const link = h(
        'a',
        { class: 'md-book-sidebar__link', href: router.href(node.entry.path) },
        node.title,
      );
      if (node.entry.path === currentPath) link.setAttribute('aria-current', 'page');
      item.append(link);
    } else {
      item.append(h('span', { class: 'md-book-sidebar__group' }, node.title));
    }
    if (node.children.length > 0) item.append(renderSidebar(node.children, router, currentPath));
    list.append(item);
  }
  return list;
}

function renderToc(entries: TocEntry[], router: Router, strings: UIStrings): HTMLElement[] {
  if (entries.length === 0) return [];
  const build = (list: TocEntry[]): HTMLElement => {
    const ul = h('ul', { class: 'md-book-toc__list' });
    for (const entry of list) {
      const li = h(
        'li',
        { class: 'md-book-toc__item' },
        h(
          'a',
          {
            class: 'md-book-toc__link',
            href: `${router.href(router.current)}#${entry.id}`,
            dataset: { id: entry.id },
          },
          entry.text,
        ),
        entry.children.length > 0 ? build(entry.children) : null,
      );
      ul.append(li);
    }
    return ul;
  };
  return [h('p', { class: 'md-book-toc__title' }, strings.onThisPageLabel), build(entries)];
}

function renderPager(prevNext: PrevNext, router: Router, strings: UIStrings): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (prevNext.prev) {
    out.push(
      h(
        'a',
        {
          class: 'md-book-pager__link md-book-pager__link--prev',
          href: router.href(prevNext.prev.path),
        },
        h('span', { class: 'md-book-pager__dir' }, strings.previous),
        h('span', { class: 'md-book-pager__title' }, prevNext.prev.title),
      ),
    );
  }
  if (prevNext.next) {
    out.push(
      h(
        'a',
        {
          class: 'md-book-pager__link md-book-pager__link--next',
          href: router.href(prevNext.next.path),
        },
        h('span', { class: 'md-book-pager__dir' }, strings.next),
        h('span', { class: 'md-book-pager__title' }, prevNext.next.title),
      ),
    );
  }
  return out;
}

function highlightCurrent(nav: HTMLElement, currentPath: string): void {
  for (const link of nav.querySelectorAll<HTMLAnchorElement>('a')) {
    const url = new URL(link.href, 'http://localhost');
    const matches =
      url.pathname === currentPath ||
      (currentPath !== '/' && url.pathname !== '/' && currentPath.startsWith(`${url.pathname}/`)) ||
      url.hash.slice(1) === currentPath;
    link.classList.toggle('is-active', matches);
    if (matches) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function applySlot(host: HTMLElement, content: SlotContent | undefined): void {
  if (content == null) {
    host.hidden = true;
    return;
  }
  if (typeof content === 'string') host.innerHTML = content;
  else host.append(content);
}
