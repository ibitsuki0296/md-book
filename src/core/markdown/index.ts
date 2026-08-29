import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import type { RenderOptions } from '../types.js';
import { anchorTocPlugin } from './plugins/anchor-toc.js';
import { containersPlugin } from './plugins/containers.js';
import { linkRewritePlugin } from './plugins/link-rewrite.js';

export type MarkdownConfig = Pick<
  RenderOptions,
  'allowHtml' | 'containers' | 'footnotes' | 'linkRewrite'
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
  });

  md.enable(['strikethrough', 'table']);

  if (config.footnotes ?? true) md.use(footnote);
  if (config.containers ?? true) containersPlugin(md);
  md.use(anchorTocPlugin);
  if (config.linkRewrite) linkRewritePlugin(md, config.linkRewrite);

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
