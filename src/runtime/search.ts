import type { UIStrings } from '../core/i18n.js';
import type { SearchResult, Searcher } from '../core/search.js';
import { h, replaceChildren } from './dom.js';

export interface SearchBoxOptions {
  /** Current UI strings (read on demand so a locale switch is picked up). */
  strings: () => UIStrings;
  /** Route path → `href` for result links. */
  href: (route: string) => string;
  navigate: (route: string) => void;
  /** Locale to restrict results to, when the site is localised. */
  locale: () => string | undefined;
  /** Loads the index on first use. */
  load: () => Promise<Searcher>;
  /** Maximum results shown. Default 8. */
  limit?: number;
}

export interface SearchBox {
  readonly element: HTMLElement;
  /** Re-applies labels after a locale change. */
  refresh(): void;
  destroy(): void;
}

const PANEL_ID = 'md-book-search-results';

/** A header search box: combobox input + live results listbox, with `/` and Ctrl/⌘K to focus. */
export function createSearchBox(options: SearchBoxOptions): SearchBox {
  const limit = options.limit ?? 8;

  const input = h('input', {
    class: 'md-book-search__input',
    type: 'search',
    role: 'combobox',
    autocomplete: 'off',
    spellcheck: 'false',
    aria: { autocomplete: 'list', expanded: 'false', controls: PANEL_ID },
  });
  const hint = h('kbd', { class: 'md-book-search__hint', aria: { hidden: 'true' } }, '/');
  const status = h('p', { class: 'md-book-search__status', role: 'status' });
  const list = h('ul', { class: 'md-book-search__list', role: 'listbox' });
  const panel = h(
    'div',
    { class: 'md-book-search__panel', id: PANEL_ID, hidden: true },
    status,
    list,
  );
  const root = h('div', { class: 'md-book-search', role: 'search' }, input, hint, panel);

  let searcher: Promise<Searcher> | undefined;
  let results: SearchResult[] = [];
  let active = -1;
  let token = 0;

  const applyLabels = () => {
    const t = options.strings();
    input.setAttribute('aria-label', t.searchLabel);
    input.placeholder = t.searchPlaceholder;
    list.setAttribute('aria-label', t.searchResultsLabel);
  };
  applyLabels();

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) input.removeAttribute('aria-activedescendant');
  };

  const setActive = (index: number) => {
    active = index;
    [...list.children].forEach((li, i) => {
      li.setAttribute('aria-selected', String(i === index));
      li.classList.toggle('is-active', i === index);
    });
    const li = list.children[index] as HTMLElement | undefined;
    if (li) {
      input.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView?.({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const close = (clear: boolean) => {
    token++;
    if (clear) input.value = '';
    results = [];
    replaceChildren(list);
    setOpen(false);
  };

  const run = async () => {
    const query = input.value.trim();
    const mine = ++token;
    if (!query) {
      close(false);
      return;
    }
    const t = options.strings();
    setOpen(true);
    replaceChildren(list);
    status.textContent = t.searchLoading;
    try {
      searcher ??= options.load();
      const engine = await searcher;
      if (mine !== token) return;
      results = engine.search(query, { limit, locale: options.locale() });
    } catch {
      searcher = undefined;
      if (mine !== token) return;
      status.textContent = options.strings().searchFailed;
      return;
    }
    const s = options.strings();
    status.textContent =
      results.length === 0 ? s.searchNoResults(query) : s.searchResultCount(results.length);
    replaceChildren(
      list,
      ...results.map((result, i) => resultItem(result, i, options.href(result.path))),
    );
    setActive(results.length > 0 ? 0 : -1);
  };

  input.addEventListener('input', () => void run());
  input.addEventListener('focus', () => {
    if (input.value.trim() && panel.hidden) void run();
  });
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return; // IME candidate selection
    switch (event.key) {
      case 'ArrowDown':
        if (results.length === 0) return;
        event.preventDefault();
        setActive((active + 1) % results.length);
        break;
      case 'ArrowUp':
        if (results.length === 0) return;
        event.preventDefault();
        setActive((active - 1 + results.length) % results.length);
        break;
      case 'Enter': {
        const target = results[active];
        if (!target) return;
        event.preventDefault();
        close(true);
        input.blur();
        options.navigate(target.path);
        break;
      }
      case 'Escape':
        if (!panel.hidden || input.value) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
        break;
    }
  });
  // Keep focus in the input while clicking results; the link click still fires.
  panel.addEventListener('mousedown', (event) => event.preventDefault());
  panel.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) close(true);
  });
  root.addEventListener('focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (!next || !root.contains(next)) setOpen(false);
  });

  const onKey = (event: KeyboardEvent) => {
    const typing =
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable || /^(?:input|textarea|select)$/i.test(event.target.tagName));
    const slash = event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;
    const chord = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
    if (!slash && !chord) return;
    event.preventDefault();
    input.focus();
    input.select();
  };
  document.addEventListener('keydown', onKey);

  return {
    element: root,
    refresh: applyLabels,
    destroy: () => {
      document.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

function resultItem(result: SearchResult, index: number, href: string): HTMLElement {
  const title = h('span', { class: 'md-book-search__title' }, result.title);
  const parts: Array<Node | string> = [title];
  if (result.heading && result.heading !== result.title) {
    parts.push(h('span', { class: 'md-book-search__heading' }, result.heading));
  }
  if (result.snippet)
    parts.push(h('span', { class: 'md-book-search__snippet' }, ...marked(result)));
  return h(
    'li',
    {
      class: 'md-book-search__item',
      role: 'option',
      id: `md-book-search-opt-${index}`,
      aria: { selected: 'false' },
    },
    h('a', { class: 'md-book-search__link', href, tabindex: '-1' }, ...parts),
  );
}

/** Snippet text with matched ranges wrapped in `<mark>` (text nodes only — no HTML injection). */
function marked(result: SearchResult): Array<Node | string> {
  const out: Array<Node | string> = [];
  let at = 0;
  for (const [start, end] of result.ranges) {
    if (start > at) out.push(result.snippet.slice(at, start));
    out.push(h('mark', {}, result.snippet.slice(start, end)));
    at = end;
  }
  if (at < result.snippet.length) out.push(result.snippet.slice(at));
  return out;
}
