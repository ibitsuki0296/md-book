import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';

const MARKER = 0x3a; // ':'
const MIN_MARKERS = 3;

export const DEFAULT_CONTAINER_TYPES = ['note', 'tip', 'info', 'warning', 'danger', 'details'];

export interface ContainerOptions {
  /** Allowed container names. Unknown names fall back to a generic block. */
  types?: string[];
}

/**
 * Fenced container blocks:
 *
 * ```
 * :::warning Heads up
 * body markdown
 * :::
 * ```
 *
 * `details` renders as a native `<details><summary>` disclosure.
 */
export function containersPlugin(md: MarkdownIt, options: ContainerOptions = {}): void {
  const known = new Set(options.types ?? DEFAULT_CONTAINER_TYPES);

  md.block.ruler.before('fence', 'md_book_container', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine]! + state.tShift[startLine]!;
    const max = state.eMarks[startLine]!;
    if (state.src.charCodeAt(start) !== MARKER) return false;

    let pos = start;
    while (pos < max && state.src.charCodeAt(pos) === MARKER) pos++;
    const markerCount = pos - start;
    if (markerCount < MIN_MARKERS) return false;

    const params = state.src.slice(pos, max).trim();
    const spaceIdx = params.search(/\s/);
    const rawType = (spaceIdx === -1 ? params : params.slice(0, spaceIdx)).toLowerCase();
    const title = spaceIdx === -1 ? '' : params.slice(spaceIdx + 1).trim();
    if (rawType.length === 0) return false;
    if (silent) return true;

    const type = known.has(rawType) ? rawType : 'note';
    const closeLine = findClosingFence(state, startLine, endLine, markerCount);

    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;
    // biome-ignore lint/suspicious/noExplicitAny: markdown-it parentType is a loose enum
    state.parentType = 'md_book_container' as any;
    state.lineMax = closeLine;

    const tokenOpen = state.push(
      'md_book_container_open',
      type === 'details' ? 'details' : 'div',
      1,
    );
    tokenOpen.markup = ':'.repeat(markerCount);
    tokenOpen.block = true;
    tokenOpen.info = type;
    tokenOpen.meta = { title };
    tokenOpen.map = [startLine, closeLine];

    state.md.block.tokenize(state, startLine + 1, closeLine);

    const tokenClose = state.push(
      'md_book_container_close',
      type === 'details' ? 'details' : 'div',
      -1,
    );
    tokenClose.markup = ':'.repeat(markerCount);
    tokenClose.block = true;

    state.parentType = oldParent;
    state.lineMax = oldLineMax;
    state.line = closeLine + (closeLine < endLine ? 1 : 0);
    return true;
  });

  md.renderer.rules.md_book_container_open = (tokens, idx) => {
    const token = tokens[idx]!;
    const type = token.info;
    const title = (token.meta?.title as string | undefined) ?? '';
    if (type === 'details') {
      const summary = title || 'Details';
      return `<details class="md-book-container md-book-container--details">\n<summary>${escapeHtml(summary)}</summary>\n`;
    }
    const heading = title ? `<p class="md-book-container__title">${escapeHtml(title)}</p>\n` : '';
    return `<div class="md-book-container md-book-container--${type}" role="note">\n${heading}`;
  };

  md.renderer.rules.md_book_container_close = (tokens, idx) => {
    return tokens[idx]!.tag === 'details' ? '</details>\n' : '</div>\n';
  };
}

function findClosingFence(
  state: StateBlock,
  startLine: number,
  endLine: number,
  markerCount: number,
): number {
  for (let line = startLine + 1; line < endLine; line++) {
    const start = state.bMarks[line]! + state.tShift[line]!;
    const max = state.eMarks[line]!;
    if (start >= max) continue;
    if (state.src.charCodeAt(start) !== MARKER) continue;
    let pos = start;
    while (pos < max && state.src.charCodeAt(pos) === MARKER) pos++;
    if (pos - start >= markerCount && state.src.slice(pos, max).trim().length === 0) {
      return line;
    }
  }
  return endLine;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
