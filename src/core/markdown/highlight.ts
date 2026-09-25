/**
 * Tiny regex-based syntax highlighter for fenced code blocks.
 *
 * Deliberately small: one ordered rule list per language family, combined into
 * a single alternation and scanned left to right. It is not a parser — it
 * colours the obvious things (comments, strings, numbers, keywords, calls,
 * types, properties) and leaves everything else as plain escaped text. Need
 * more? Pass `highlight: (code, lang) => html` to `mount()` and plug in Shiki
 * or highlight.js.
 *
 * Pure and DOM-free. Input is always HTML-escaped, so the output is safe.
 */

/** Token kinds; each renders as `<span class="md-book-tok-{kind}">`. */
type Kind = 'comment' | 'string' | 'keyword' | 'number' | 'function' | 'type' | 'attr' | 'literal';
type Rule = [kind: Kind | 'inserted' | 'deleted', source: string];
interface Grammar {
  re: RegExp;
  kinds: Rule[0][];
}

const words = (list: string) => `\\b(?:${list.trim().split(/\s+/).join('|')})\\b`;

const NUMBER = '\\b0[xX][\\da-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?n?\\b';
const DQ = '"(?:\\\\.|[^"\\\\\\n])*"';
const SQ = "'(?:\\\\.|[^'\\\\\\n])*'";
const CALL = '\\b[A-Za-z_$][\\w$]*(?=\\()';
const TYPE = '\\b[A-Z][\\w$]*\\b';

const JS_KEYWORDS = words(`
  as async await break case catch class const continue debugger default delete do else enum
  export extends finally for from function get if implements import in instanceof interface let
  new of package private protected public readonly return satisfies set static super switch
  throw try type typeof var void while with yield abstract declare namespace keyof
`);

const PY_KEYWORDS = words(`
  and as assert async await break class continue def del elif else except finally for from
  global if import in is lambda nonlocal not or pass raise return try while with yield match case
`);

const SH_KEYWORDS = words(`
  if then else elif fi for while until do done case esac in function return export local
  source alias unset select
`);

const GRAMMARS: Record<string, Rule[]> = {
  js: [
    ['comment', '//.*|/\\*[\\s\\S]*?\\*/'],
    ['string', `\`(?:\\\\[\\s\\S]|[^\`\\\\])*\`|${DQ}|${SQ}`],
    ['keyword', JS_KEYWORDS],
    ['literal', words('true false null undefined this NaN Infinity')],
    ['number', NUMBER],
    ['function', CALL],
    ['type', TYPE],
  ],
  py: [
    ['comment', '#.*'],
    ['string', `[rbfRBF]{0,2}(?:"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|${DQ}|${SQ})`],
    ['keyword', PY_KEYWORDS],
    ['literal', words('True False None self cls')],
    ['number', NUMBER],
    ['function', CALL],
    ['type', TYPE],
  ],
  sh: [
    ['comment', '\\B#.*'],
    ['string', `${DQ}|${SQ}`],
    ['attr', '\\$(?:\\{[^}\\n]*\\}|[\\w@#?*!$-]+)'],
    ['keyword', SH_KEYWORDS],
    ['literal', '\\B--?[a-zA-Z][\\w-]*'],
    ['number', NUMBER],
  ],
  json: [
    ['attr', `${DQ}(?=\\s*:)`],
    ['string', DQ],
    ['literal', words('true false null')],
    ['number', '-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b'],
  ],
  css: [
    ['comment', '/\\*[\\s\\S]*?\\*/'],
    ['string', `${DQ}|${SQ}`],
    ['keyword', '@[\\w-]+'],
    ['attr', '--[\\w-]+'],
    ['number', '#[\\da-fA-F]{3,8}\\b|-?\\b\\d*\\.?\\d+(?:%|[a-z]{1,4})?\\b'],
    ['function', '\\b[\\w-]+(?=\\()'],
    ['attr', '-?[a-zA-Z][\\w-]*(?=\\s*:)'],
  ],
  html: [
    ['comment', '<!--[\\s\\S]*?-->'],
    ['type', '</?[A-Za-z][\\w:.-]*'],
    ['attr', '[\\w:@.-]+(?=\\s*=)'],
    ['string', `${DQ}|${SQ}`],
  ],
  yaml: [
    ['comment', '\\B#.*'],
    ['attr', '[\\w.-]+(?=:(?:\\s|$))'],
    ['string', `${DQ}|${SQ}`],
    ['literal', words('true false null yes no on off')],
    ['number', NUMBER],
  ],
  diff: [
    ['inserted', '^\\+.*'],
    ['deleted', '^-.*'],
    ['keyword', '^@@.*'],
    ['comment', '^(?:diff|index).*'],
  ],
};

const ALIASES: Record<string, string> = {
  javascript: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'js',
  typescript: 'js',
  tsx: 'js',
  python: 'py',
  bash: 'sh',
  shell: 'sh',
  zsh: 'sh',
  jsonc: 'json',
  json5: 'json',
  scss: 'css',
  less: 'css',
  xml: 'html',
  svg: 'html',
  vue: 'html',
  xhtml: 'html',
  yml: 'yaml',
  patch: 'diff',
};

const compiled = new Map<string, Grammar>();

function grammarFor(lang: string): Grammar | undefined {
  const key = ALIASES[lang] ?? lang;
  const cached = compiled.get(key);
  if (cached) return cached;
  const rules = Object.prototype.hasOwnProperty.call(GRAMMARS, key) ? GRAMMARS[key] : undefined;
  if (!rules) return undefined;
  const grammar: Grammar = {
    re: new RegExp(rules.map(([, source]) => `(${source})`).join('|'), 'gm'),
    kinds: rules.map(([kind]) => kind),
  };
  compiled.set(key, grammar);
  return grammar;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Highlights `code` and returns the inner HTML for a `<code>` element, or an
 * empty string when `lang` is unknown (callers then fall back to plain escaped
 * text).
 */
export function highlightCode(code: string, lang: string | null | undefined): string {
  const grammar = lang ? grammarFor(lang.toLowerCase()) : undefined;
  if (!grammar) return '';

  const { re, kinds } = grammar;
  re.lastIndex = 0;
  let out = '';
  let last = 0;
  for (let m = re.exec(code); m !== null; m = re.exec(code)) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    const index = kinds.findIndex((_, i) => m[i + 1] !== undefined);
    out += `${escapeHtml(code.slice(last, m.index))}<span class="md-book-tok-${kinds[index]}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
}
