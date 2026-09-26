import { type HeadData, type HeadInput, type SeoConfig, buildHead } from '../core/head.js';

export type { HeadInput, SeoConfig };

const MANAGED_ATTR = 'data-md-book-head';

/**
 * Reconciles `<title>` and the document's social / canonical meta with the
 * current page. Only tags it created are touched, so hand-authored `<head>`
 * content is left alone.
 */
export function applyHead(input: HeadInput, config: SeoConfig): void {
  if (typeof document === 'undefined') return;

  const head = buildHead(input, config, {
    origin: typeof location !== 'undefined' ? location.origin : undefined,
  });
  document.title = head.title;

  const seen = head.tags.map((t) => upsert(t.tag, t.attrs, t.value));
  pruneStale(seen);
  applyJsonLd(head);
}

function upsert(tag: 'meta' | 'link', attrs: Record<string, string>, value: string): Element {
  const selector = Object.entries(attrs)
    .map(([k, v]) => `[${k}="${v.replace(/"/g, '\\"')}"]`)
    .join('');
  let el = document.head.querySelector(`${tag}${selector}`);
  if (!el) {
    el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute(MANAGED_ATTR, '');
  el.setAttribute(tag === 'link' ? 'href' : 'content', value);
  return el;
}

function pruneStale(keep: Element[]): void {
  for (const el of document.head.querySelectorAll(`meta[${MANAGED_ATTR}],link[${MANAGED_ATTR}]`)) {
    if (!keep.includes(el)) el.remove();
  }
}

function applyJsonLd(head: HeadData): void {
  let script = document.head.querySelector<HTMLScriptElement>(
    `script[type="application/ld+json"][${MANAGED_ATTR}]`,
  );
  if (!head.jsonLd) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(MANAGED_ATTR, '');
    document.head.appendChild(script);
  }
  script.textContent = head.jsonLd;
}
