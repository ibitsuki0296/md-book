import type MarkdownIt from 'markdown-it';

const OPEN = 0x7b; // '{'

/**
 * Ruby annotations (ふりがな): `{漢字|かんじ}` renders as
 * `<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>`.
 *
 * The base and the reading are plain text (escaped). Anything that is not
 * exactly `{base|reading}` on a single line is left as literal text.
 */
export function rubyPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'md_book_ruby', (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== OPEN) return false;

    const end = state.src.indexOf('}', start + 1);
    if (end === -1 || end >= state.posMax) return false;

    const inner = state.src.slice(start + 1, end);
    const bar = inner.indexOf('|');
    if (bar <= 0 || bar === inner.length - 1) return false;
    if (inner.indexOf('|', bar + 1) !== -1) return false;
    if (/[{}\n]/.test(inner)) return false;

    if (!silent) {
      const token = state.push('md_book_ruby', 'ruby', 0);
      token.content = inner.slice(0, bar);
      token.meta = { reading: inner.slice(bar + 1) };
    }
    state.pos = end + 1;
    return true;
  });

  md.renderer.rules.md_book_ruby = (tokens, idx) => {
    const token = tokens[idx]!;
    const { escapeHtml } = md.utils;
    const reading = escapeHtml((token.meta?.reading as string | undefined) ?? '');
    return `<ruby>${escapeHtml(token.content)}<rp>(</rp><rt>${reading}</rt><rp>)</rp></ruby>`;
  };
}
