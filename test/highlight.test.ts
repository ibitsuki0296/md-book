import { describe, expect, it } from 'vitest';
import { highlightCode } from '../src/core/markdown/highlight.js';
import { renderMarkdown } from '../src/core/render.js';

const tok = (kind: string, text: string) => `<span class="md-book-tok-${kind}">${text}</span>`;

describe('highlightCode', () => {
  it('returns an empty string for unknown or missing languages', () => {
    expect(highlightCode('x', 'brainfuck')).toBe('');
    expect(highlightCode('x', null)).toBe('');
    expect(highlightCode('x', 'constructor')).toBe('');
  });

  it('tokenises js: keyword, call, string, number, literal, comment', () => {
    const html = highlightCode('const n = f(1, "a"); // hi\nreturn true', 'ts');
    expect(html).toContain(tok('keyword', 'const'));
    expect(html).toContain(tok('function', 'f'));
    expect(html).toContain(tok('number', '1'));
    expect(html).toContain(tok('string', '"a"'));
    expect(html).toContain(tok('comment', '// hi'));
    expect(html).toContain(tok('literal', 'true'));
  });

  it('escapes html in code and inside tokens', () => {
    const html = highlightCode('<b>x</b> & "<i>"', 'js');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain(tok('string', '"&lt;i&gt;"'));
    expect(html).toContain('&amp;');
  });

  it('does not colour comment markers inside strings', () => {
    const html = highlightCode('const u = "http://x.test"', 'js');
    expect(html).not.toContain('md-book-tok-comment');
  });

  it('marks json keys apart from string values', () => {
    const html = highlightCode('{"a": "b", "n": 2, "ok": null}', 'json');
    expect(html).toContain(tok('attr', '"a"'));
    expect(html).toContain(tok('string', '"b"'));
    expect(html).toContain(tok('number', '2'));
    expect(html).toContain(tok('literal', 'null'));
  });

  it('handles css custom properties and values', () => {
    const html = highlightCode(':root { --md-book-gray-50: #fafafa; margin: 0 auto; }', 'css');
    expect(html).toContain(tok('attr', '--md-book-gray-50'));
    expect(html).toContain(tok('number', '#fafafa'));
    expect(html).toContain(tok('attr', 'margin'));
  });

  it('handles shell comments, flags and variables', () => {
    const html = highlightCode('npm i -D foo # dev\necho $HOME', 'bash');
    expect(html).toContain(tok('literal', '-D'));
    expect(html).toContain(tok('comment', '# dev'));
    expect(html).toContain(tok('attr', '$HOME'));
  });

  it('handles html tags and attributes', () => {
    const html = highlightCode('<a href="/x">hi</a>', 'html');
    expect(html).toContain(tok('type', '&lt;a'));
    expect(html).toContain(tok('attr', 'href'));
    expect(html).toContain(tok('string', '"/x"'));
  });

  it('marks diff additions and removals', () => {
    const html = highlightCode('+ added\n- removed\n context', 'diff');
    expect(html).toContain(tok('inserted', '+ added'));
    expect(html).toContain(tok('deleted', '- removed'));
  });

  it('is stable across repeated calls (shared regex state)', () => {
    const a = highlightCode('let x = 1', 'js');
    expect(highlightCode('let x = 1', 'js')).toBe(a);
  });

  it('never loses or reorders characters', () => {
    const code = 'if (a) {\n  return `t ${b}` + 0x1f; /* c */\n}\n';
    const plain = highlightCode(code, 'js').replace(/<[^>]+>/g, '');
    expect(plain).toBe(code);
  });
});

describe('renderMarkdown highlighting', () => {
  const src = '```ts\nconst a = 1;\n```\n\n```nope\n<x>\n```\n';

  it('highlights known fences by default and keeps the language class', () => {
    const { html } = renderMarkdown(src);
    expect(html).toContain('<code class="language-ts">');
    expect(html).toContain(tok('keyword', 'const'));
  });

  it('leaves unknown languages as plain escaped text', () => {
    const { html } = renderMarkdown(src);
    expect(html).toContain('&lt;x&gt;');
  });

  it('can be turned off', () => {
    const { html } = renderMarkdown(src, { highlight: false });
    expect(html).not.toContain('md-book-tok-');
  });
});
