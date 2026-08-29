import type MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';

export interface LinkRewriteOptions {
  /** Route path of the page being rendered, e.g. `/guide/intro`. */
  currentPath: string;
  /** Site base path. Default `/`. */
  base?: string;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:)/i;
const MD_EXT = /\.(?:md|markdown)(?=$|[#?])/i;

/** Rewrites in-repo `*.md` links to clean route paths. */
export function linkRewritePlugin(md: MarkdownIt, options: LinkRewriteOptions): void {
  const base = normalizeBase(options.base ?? '/');
  const fromDir = dirname(options.currentPath);

  md.core.ruler.push('md_book_link_rewrite', (state: StateCore) => {
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.children) continue;
      for (const child of token.children) {
        if (child.type !== 'link_open') continue;
        const href = child.attrGet('href');
        if (!href || EXTERNAL.test(href) || !MD_EXT.test(href)) continue;
        child.attrSet('href', rewrite(href, fromDir, base));
        child.attrJoin('class', 'md-book-internal-link');
      }
    }
    return true;
  });
}

function rewrite(href: string, fromDir: string, base: string): string {
  const hashIdx = href.search(/[#?]/);
  const suffix = hashIdx === -1 ? '' : href.slice(hashIdx);
  let path = (hashIdx === -1 ? href : href.slice(0, hashIdx)).replace(MD_EXT, '');

  const absolute = path.startsWith('/');
  const segments = (absolute ? path : `${fromDir}/${path}`).split('/');
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') resolved.pop();
    else resolved.push(seg);
  }

  const last = resolved[resolved.length - 1]?.toLowerCase();
  if (last === 'index' || last === 'readme') resolved.pop();

  path = `/${resolved.join('/')}`;
  const withBase = base === '/' ? path : `${base}${path === '/' ? '' : path}`;
  return `${withBase}${suffix}`;
}

function dirname(routePath: string): string {
  const clean = routePath.replace(/\/+$/, '');
  const idx = clean.lastIndexOf('/');
  return idx <= 0 ? '' : clean.slice(0, idx);
}

function normalizeBase(base: string): string {
  if (base === '' || base === '/') return '/';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}
