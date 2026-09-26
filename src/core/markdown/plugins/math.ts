import type MarkdownIt from 'markdown-it';

/** Turns TeX into an HTML string (e.g. `katex.renderToString`). Used for build-time rendering. */
export type MathRenderer = (tex: string, displayMode: boolean) => string;

const DOLLAR = 0x24; // '$'
const BACKSLASH = 0x5c;

/**
 * TeX math: `$inline$` and `$$display$$` (inline or as a fenced block).
 *
 * Pandoc-style delimiting keeps prose with currency safe: an opening `$` must
 * be followed by a non-space, a closing `$` must be preceded by a non-space and
 * must not be followed by a digit (`costs $5 and $10` stays text).
 *
 * Without a `render` function the TeX is emitted escaped inside a
 * `.md-book-math` element and the runtime typesets it (KaTeX). With one, the
 * HTML it returns is embedded directly (SSG); a renderer that throws falls
 * back to the escaped-TeX element.
 */
export function mathPlugin(md: MarkdownIt, render?: MathRenderer): void {
  md.inline.ruler.after('escape', 'md_book_math_inline', (state, silent) => {
    const src = state.src;
    const start = state.pos;
    if (src.charCodeAt(start) !== DOLLAR) return false;

    const display = src.charCodeAt(start + 1) === DOLLAR;
    const open = display ? 2 : 1;
    const first = src.charAt(start + open);
    if (first === '' || (!display && /\s/.test(first))) return false;

    // Find the closing delimiter.
    let end = start + open;
    for (;;) {
      end = src.indexOf('$', end);
      if (end === -1 || end >= state.posMax) return false;
      if (src.charCodeAt(end - 1) === BACKSLASH) {
        end++;
        continue;
      }
      if (display) {
        if (src.charCodeAt(end + 1) === DOLLAR) break;
        end++;
        continue;
      }
      break;
    }

    const content = src.slice(start + open, end);
    if (content.length === 0) return false;
    if (!display) {
      if (/\s$/.test(content)) return false;
      if (/\d/.test(src.charAt(end + 1))) return false;
    }

    if (!silent) {
      const token = state.push('md_book_math', 'span', 0);
      token.content = content.trim();
      token.meta = { display };
    }
    state.pos = end + (display ? 2 : 1);
    return true;
  });

  md.block.ruler.after(
    'blockquote',
    'md_book_math_block',
    (state, startLine, endLine, silent) => {
      let pos = state.bMarks[startLine]! + state.tShift[startLine]!;
      let max = state.eMarks[startLine]!;
      if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
      if (state.src.slice(pos, pos + 2) !== '$$') return false;
      if (silent) return true;

      pos += 2;
      let firstLine = state.src.slice(pos, max);
      let lastLine = '';
      let found = false;
      let next = startLine;

      if (firstLine.trim().endsWith('$$')) {
        // Single-line form: $$ x^2 $$
        firstLine = firstLine.trim().slice(0, -2);
        found = true;
      }

      while (!found) {
        next++;
        if (next >= endLine) break;
        pos = state.bMarks[next]! + state.tShift[next]!;
        max = state.eMarks[next]!;
        if (state.sCount[next]! - state.blkIndent >= 4) continue;
        const line = state.src.slice(pos, max);
        if (line.trim().endsWith('$$')) {
          lastLine = line.trim().slice(0, -2);
          found = true;
        }
      }
      if (!found) return false;

      const body = state.getLines(startLine + 1, next, state.sCount[startLine]!, true);
      const token = state.push('md_book_math_block', 'div', 0);
      token.block = true;
      token.content = [firstLine, body.trimEnd(), lastLine]
        .filter((part) => part.trim().length > 0)
        .join('\n')
        .trim();
      token.map = [startLine, next + 1];
      token.meta = { display: true };
      state.line = next + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  const emit = (tex: string, display: boolean, block: boolean): string => {
    const { escapeHtml } = md.utils;
    const tag = block ? 'div' : 'span';
    const cls = `md-book-math${display ? ' md-book-math--display' : ''}`;
    const tail = block ? '\n' : '';
    if (render) {
      try {
        const html = render(tex, display);
        return `<${tag} class="${cls} md-book-math--rendered">${html}</${tag}>${tail}`;
      } catch {
        // fall through to the escaped source
      }
    }
    return `<${tag} class="${cls}">${escapeHtml(tex)}</${tag}>${tail}`;
  };

  md.renderer.rules.md_book_math = (tokens, idx) => {
    const token = tokens[idx]!;
    return emit(token.content, Boolean(token.meta?.display), false);
  };
  md.renderer.rules.md_book_math_block = (tokens, idx) => emit(tokens[idx]!.content, true, true);
}
