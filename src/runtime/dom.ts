/** Minimal DOM helpers — no framework, keeps the CDN bundle small. */

type Child = Node | string | null | undefined | false;

export interface ElAttrs {
  class?: string;
  id?: string;
  href?: string;
  type?: string;
  title?: string;
  role?: string;
  hidden?: boolean;
  dataset?: Record<string, string>;
  aria?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, EventListener>>;
  [key: string]: unknown;
}

/** Creates an element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElAttrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value as Record<string, string>)) el.dataset[dk] = dv;
    } else if (key === 'aria') {
      for (const [ak, av] of Object.entries(value as Record<string, string>)) {
        el.setAttribute(`aria-${ak}`, av);
      }
    } else if (key === 'on') {
      for (const [ev, fn] of Object.entries(value as Record<string, EventListener>)) {
        el.addEventListener(ev, fn);
      }
    } else if (key === 'hidden') {
      el.hidden = Boolean(value);
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/** Replaces all children of `parent` with `next`. */
export function replaceChildren(parent: Element, ...next: Child[]): void {
  parent.replaceChildren();
  append(parent, next);
}

/** Parses a trusted HTML fragment (already sanitized by the renderer) into a node. */
export function fragmentFromHTML(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}
