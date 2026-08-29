import GithubSlugger from 'github-slugger';
import type MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import type { TocEntry } from '../../types.js';

export interface AnchorTocEnv {
  /** Populated by the plugin: every heading in document order. */
  headings?: TocEntry[];
}

/**
 * Assigns stable slug ids to headings, injects a clickable permalink anchor,
 * and records the heading outline into `env.headings`.
 */
export function anchorTocPlugin(md: MarkdownIt): void {
  md.core.ruler.push('md_book_anchor_toc', (state: StateCore) => {
    const env = state.env as AnchorTocEnv;
    const slugger = new GithubSlugger();
    const headings: TocEntry[] = [];
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (!open || open.type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      if (!inline || inline.type !== 'inline') continue;

      const text = renderInlineText(inline.children ?? []);
      const level = Number.parseInt(open.tag.slice(1), 10);
      const explicitId = open.attrGet('id');
      const id =
        explicitId && explicitId.length > 0 ? explicitId : slugger.slug(text || `section-${i}`);

      open.attrSet('id', id);
      open.attrJoin('class', 'md-book-heading');
      headings.push({ level, id, text, children: [] });

      inline.children = [...(inline.children ?? []), makeAnchorToken(state, id, text)];
    }

    env.headings = headings;
    return true;
  });
}

function makeAnchorToken(state: StateCore, id: string, text: string): Token {
  const token = new state.Token('html_inline', '', 0);
  const label = text ? `Permalink to “${escapeAttr(text)}”` : 'Permalink to this section';
  token.content = `<a class="md-book-anchor" href="#${escapeAttr(id)}" aria-label="${label}">#</a>`;
  return token;
}

function renderInlineText(children: Token[]): string {
  let out = '';
  for (const child of children) {
    if (child.type === 'text' || child.type === 'code_inline') out += child.content;
    else if (child.type === 'softbreak' || child.type === 'hardbreak') out += ' ';
  }
  return out.trim();
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Builds a nested TOC from a flat heading list, keeping only levels in `[min, max]`. */
export function buildToc(headings: TocEntry[], depth: [number, number]): TocEntry[] {
  const [min, max] = depth;
  const roots: TocEntry[] = [];
  const stack: TocEntry[] = [];

  for (const h of headings) {
    if (h.level < min || h.level > max) continue;
    const node: TocEntry = { ...h, children: [] };
    while (stack.length > 0 && stack[stack.length - 1]!.level >= node.level) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1]!.children.push(node);
    stack.push(node);
  }

  return roots;
}
