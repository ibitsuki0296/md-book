import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/index.js';

const math = (src: string, options: Parameters<typeof renderMarkdown>[1] = { math: true }) =>
  renderMarkdown(src, options).html;

describe('math', () => {
  it('is off by default', () => {
    expect(math('$x$', {})).not.toContain('md-book-math');
  });

  it('renders inline TeX as an escaped span', () => {
    expect(math('Let $a < b$ hold.')).toContain('<span class="md-book-math">a &lt; b</span>');
  });

  it('renders $$…$$ as a display block, single- and multi-line', () => {
    const single = math('$$ E = mc^2 $$');
    expect(single).toContain('<div class="md-book-math md-book-math--display">E = mc^2</div>');
    const multi = math('before\n\n$$\n\\int_0^1 x\\,dx\n= \\tfrac12\n$$\n\nafter');
    expect(multi).toContain('md-book-math--display');
    expect(multi).toContain('\\int_0^1 x\\,dx\n= \\tfrac12');
    expect(multi).toContain('<p>before</p>');
    expect(multi).toContain('<p>after</p>');
  });

  it('supports inline display math inside a paragraph', () => {
    const html = math('so $$x^2$$ here');
    expect(html).toContain('<span class="md-book-math md-book-math--display">x^2</span>');
    expect(html).toContain('<p>so ');
  });

  it('leaves currency and escaped dollars alone', () => {
    expect(math('It costs $5 and $10 today.')).not.toContain('md-book-math');
    expect(math('a \\$b\\$ c')).not.toContain('md-book-math');
    expect(math('an empty $$ pair')).not.toContain('md-book-math');
  });

  it('does not touch code spans or fences', () => {
    expect(math('`$x$`')).not.toContain('md-book-math');
    expect(math('```\n$$x$$\n```')).not.toContain('md-book-math');
  });

  it('uses a build-time renderer when given, and falls back if it throws', () => {
    const rendered = math('$x$ and $$y$$', {
      math: { render: (tex, display) => `<i data-d="${display}">${tex}</i>` },
    });
    expect(rendered).toContain('md-book-math--rendered"><i data-d="false">x</i>');
    expect(rendered).toContain('<i data-d="true">y</i>');

    const failed = math('$x$', {
      math: {
        render: () => {
          throw new Error('bad tex');
        },
      },
    });
    expect(failed).toContain('<span class="md-book-math">x</span>');
  });

  it('escapes TeX so it cannot inject markup', () => {
    expect(math('$<img src=x onerror=alert(1)>$')).not.toContain('<img');
  });
});

describe('mermaid', () => {
  const src = '```mermaid\ngraph TD\n  A-->B\n```';

  it('is off by default (plain code block)', () => {
    expect(renderMarkdown(src).html).toContain('<pre><code class="language-mermaid">');
  });

  it('emits an escaped <pre class="md-book-mermaid"> when enabled', () => {
    const html = renderMarkdown(src, { mermaid: true }).html;
    expect(html).toContain('<pre class="md-book-mermaid">graph TD\n  A--&gt;B\n</pre>');
    expect(html).not.toContain('language-mermaid');
  });

  it('leaves other fences alone', () => {
    expect(renderMarkdown('```js\nx\n```', { mermaid: true }).html).toContain('language-js');
  });
});
