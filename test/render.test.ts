import { describe, expect, it } from 'vitest';
import { buildToc, renderMarkdown } from '../src/index.js';
import type { TocEntry } from '../src/index.js';

describe('renderMarkdown', () => {
  it('renders basic Markdown to HTML', () => {
    const { html } = renderMarkdown('# Hello\n\nSome **bold** text.');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('parses YAML front matter and keeps it out of the body', () => {
    const { frontMatter, html } = renderMarkdown(
      ['---', 'title: Intro', 'tags: [a, b]', 'draft: true', '---', '', '# Body'].join('\n'),
    );
    expect(frontMatter.title).toBe('Intro');
    expect(frontMatter.tags).toEqual(['a', 'b']);
    expect(frontMatter.draft).toBe(true);
    expect(html).not.toContain('title: Intro');
  });

  it('assigns slug ids to headings and injects a permalink anchor', () => {
    const { html, headings } = renderMarkdown('## Getting Started\n\ntext');
    expect(html).toContain('id="getting-started"');
    expect(html).toContain('class="md-book-anchor" href="#getting-started"');
    expect(headings[0]).toMatchObject({ level: 2, id: 'getting-started', text: 'Getting Started' });
  });

  it('deduplicates repeated heading slugs', () => {
    const { headings } = renderMarkdown('## Notes\n\na\n\n## Notes\n\nb');
    expect(headings.map((h) => h.id)).toEqual(['notes', 'notes-1']);
  });

  it('builds a nested TOC limited to the requested depth', () => {
    const md = ['# Title', '## A', '### A.1', '#### too deep', '## B'].join('\n\n');
    const { toc } = renderMarkdown(md, { tocDepth: [2, 3] });
    expect(toc.map((n) => n.text)).toEqual(['A', 'B']);
    expect(toc[0]?.children.map((n) => n.text)).toEqual(['A.1']);
    expect(flatten(toc).some((n) => n.text === 'too deep')).toBe(false);
  });

  it('supports GFM tables and strikethrough', () => {
    const { html } = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~');
    expect(html).toContain('<table>');
    expect(html).toContain('<s>gone</s>');
  });

  it('renders :::warning container blocks with a title', () => {
    const { html } = renderMarkdown(':::warning Heads up\nbe careful\n:::');
    expect(html).toContain('md-book-container--warning');
    expect(html).toContain('md-book-container__title">Heads up');
    expect(html).toContain('be careful');
  });

  it('renders :::details as a native disclosure', () => {
    const { html } = renderMarkdown(':::details More\nhidden\n:::');
    expect(html).toContain('<details');
    expect(html).toContain('<summary>More</summary>');
  });

  it('rewrites relative .md links to route paths', () => {
    const { html } = renderMarkdown('[next](../guide/setup.md#install)', {
      linkRewrite: { currentPath: '/blog/intro', base: '/' },
    });
    expect(html).toContain('href="/guide/setup#install"');
  });

  it('rewrites index.md / README.md links to the directory route', () => {
    const { html } = renderMarkdown('[home](./index.md) and [guide](../guide/README.md)', {
      linkRewrite: { currentPath: '/blog/post' },
    });
    expect(html).toContain('href="/blog"');
    expect(html).toContain('href="/guide"');
  });

  it('honours a site base path when rewriting links', () => {
    const { html } = renderMarkdown('[x](./other.md)', {
      linkRewrite: { currentPath: '/guide/intro', base: '/docs/' },
    });
    expect(html).toContain('href="/docs/guide/other"');
  });

  it('leaves external and non-md links untouched', () => {
    const { html } = renderMarkdown(
      '[ext](https://example.com/a.md) [hash](#top) [img](./pic.png)',
      { linkRewrite: { currentPath: '/x' } },
    );
    expect(html).toContain('href="https://example.com/a.md"');
    expect(html).toContain('href="#top"');
    expect(html).toContain('href="./pic.png"');
  });

  it('marks external links with rel and a class', () => {
    const { html } = renderMarkdown('[out](https://example.com)');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('md-book-external-link');
  });

  it('derives an excerpt from the first paragraph', () => {
    const { excerpt } = renderMarkdown(
      '# Title\n\nFirst paragraph with a [link](/x) here.\n\nSecond.',
    );
    expect(excerpt).toBe('First paragraph with a link here.');
  });

  it('prefers front matter description for the excerpt', () => {
    const { excerpt } = renderMarkdown(
      ['---', 'description: Hand-written summary', '---', '', 'Body paragraph.'].join('\n'),
    );
    expect(excerpt).toBe('Hand-written summary');
  });

  it('truncates long excerpts on a word boundary with an ellipsis', () => {
    const long = `${'word '.repeat(60)}`.trim();
    const { excerpt } = renderMarkdown(long, { excerptLength: 50 });
    expect(excerpt.length).toBeLessThanOrEqual(51);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).not.toContain('  ');
  });

  it('escapes raw HTML by default and passes it through when allowed', () => {
    const src = 'text <span data-x="1">raw</span>';
    expect(renderMarkdown(src).html).toContain('&lt;span');
    expect(renderMarkdown(src, { allowHtml: true }).html).toContain('<span data-x="1">');
  });

  it('renders footnotes', () => {
    const { html } = renderMarkdown('Claim.[^1]\n\n[^1]: Because reasons.');
    expect(html).toContain('footnote-ref');
    expect(html).toContain('Because reasons.');
  });
});

describe('buildToc', () => {
  it('nests headings by level and skips out-of-range entries', () => {
    const headings: TocEntry[] = [
      { level: 1, id: 't', text: 'T', children: [] },
      { level: 2, id: 'a', text: 'A', children: [] },
      { level: 3, id: 'a1', text: 'A1', children: [] },
      { level: 2, id: 'b', text: 'B', children: [] },
    ];
    const toc = buildToc(headings, [2, 3]);
    expect(toc).toHaveLength(2);
    expect(toc[0]?.children[0]?.id).toBe('a1');
  });
});

function flatten(entries: TocEntry[]): TocEntry[] {
  return entries.flatMap((e) => [e, ...flatten(e.children)]);
}
