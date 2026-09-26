import { parseFrontMatter } from './frontmatter.js';
import { createMarkdown } from './markdown/index.js';
import type { AnchorTocEnv } from './markdown/plugins/anchor-toc.js';
import { buildToc } from './markdown/plugins/anchor-toc.js';
import type { FrontMatter, RenderOptions, RenderResult } from './types.js';

const DEFAULT_TOC_DEPTH: [number, number] = [2, 3];
const DEFAULT_EXCERPT_LENGTH = 200;

/**
 * Parses a Markdown document (front matter + body) into rendered HTML plus the
 * structured metadata the runtime and SSG layers need. Pure and DOM-free.
 */
export function renderMarkdown(source: string, options: RenderOptions = {}): RenderResult {
  const parsed = parseFrontMatter(source);
  const frontMatter = parsed.data as FrontMatter;
  const body = parsed.content;

  const md = createMarkdown({
    allowHtml: options.allowHtml,
    containers: options.containers,
    footnotes: options.footnotes,
    highlight: options.highlight,
    linkRewrite: options.linkRewrite,
    math: options.math,
    mermaid: options.mermaid,
    ruby: options.ruby,
  });

  const env: AnchorTocEnv = {};
  const html = md.render(body, env);
  const headings = env.headings ?? [];

  const depth = options.tocDepth ?? DEFAULT_TOC_DEPTH;
  const toc = buildToc(headings, depth);

  const excerpt =
    typeof frontMatter.description === 'string' && frontMatter.description.length > 0
      ? frontMatter.description
      : extractExcerpt(
          md,
          body,
          options.excerptLength ?? DEFAULT_EXCERPT_LENGTH,
          options.ruby ?? true,
        );

  return { html, frontMatter, toc, headings, excerpt };
}

function extractExcerpt(
  md: ReturnType<typeof createMarkdown>,
  body: string,
  maxLength: number,
  ruby: boolean,
): string {
  const tokens = md.parse(body, {});
  let text = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token?.type !== 'paragraph_open') continue;
    const inline = tokens[i + 1];
    if (inline?.type === 'inline') {
      text = flattenInline(inline.content, ruby);
      break;
    }
  }
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

function flattenInline(content: string, ruby: boolean): string {
  return (ruby ? content.replace(/\{([^{}|\n]+)\|[^{}|\n]+\}/g, '$1') : content) // ruby -> base
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links / images -> label
    .replace(/[*_`~]+/g, '') // emphasis / code marks
    .replace(/\s+/g, ' ')
    .trim();
}
