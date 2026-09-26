import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import type { RenderOptions } from '../types.js';
import { highlightCode } from './highlight.js';
import { anchorTocPlugin } from './plugins/anchor-toc.js';
import { containersPlugin } from './plugins/containers.js';
import { linkRewritePlugin } from './plugins/link-rewrite.js';
import { mathPlugin } from './plugins/math.js';
import { rubyPlugin } from './plugins/ruby.js';

export type MarkdownConfig = Pick<
  RenderOptions,
  | 'allowHtml'
  | 'containers'
  | 'footnotes'
  | 'highlight'
  | 'linkRewrite'
  | 'math'
  | 'mermaid'
  | 'ruby'
>;

/**
 * Builds a configured markdown-it instance. Callers that render many pages with
 * the same structural options but different `linkRewrite.currentPath` should
 * prefer {@link createMarkdown} once with `linkRewrite: false` and instead run
 * link rewriting per page — but for typical sites rebuilding per render is fine.
 */
export function createMarkdown(config: MarkdownConfig = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: config.allowHtml ?? false,
    linkify: true,
    typographer: true,
    breaks: false,
    // Empty string → markdown-it falls back to plain escaped code.
    highlight: (config.highlight ?? true) ? (code, lang) => highlightCode(code, lang) : undefined,
  });

  md.enable(['strikethrough', 'table']);

  if (config.footnotes ?? true) md.use(footnote);
  if (config.containers ?? true) containersPlugin(md);
  if (config.ruby ?? true) rubyPlugin(md);
  if (config.math) mathPlugin(md, typeof config.math === 'object' ? config.math.render : undefined);
  md.use(anchorTocPlugin);
  if (config.linkRewrite) linkRewritePlugin(md, config.linkRewrite);

  if (config.mermaid) mermaidFence(md);

  // Mark external links so themes/runtime can decorate them.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const href = tokens[idx]?.attrGet('href') ?? '';
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href)) {
      tokens[idx]?.attrJoin('class', 'md-book-external-link');
      tokens[idx]?.attrSet('rel', 'noopener noreferrer');
    }
    return defaultLinkOpen(tokens, idx, opts, env, self);
  };

  return md;
}

/** ```mermaid fences become `<pre class="md-book-mermaid">` (escaped source) for the runtime to draw. */
function mermaidFence(md: MarkdownIt): void {
  const fallback =
    md.renderer.rules.fence ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]!;
    if (token.info.trim().split(/\s+/)[0] === 'mermaid') {
      return `<pre class="md-book-mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
    }
    return fallback(tokens, idx, opts, env, self);
  };
}
