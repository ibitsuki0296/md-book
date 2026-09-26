/**
 * Lazy typesetting of TeX math (KaTeX) and diagrams (Mermaid).
 *
 * Neither library is bundled: pages that contain no math / diagram never load
 * anything. By default the ES build is imported from jsDelivr on first use;
 * pass `load` to serve your own copy (or `() => import('katex')` in a bundler).
 */

/** The slice of KaTeX's API this module uses. */
export interface KatexLike {
  render(tex: string, element: HTMLElement, options?: Record<string, unknown>): void;
}

/** The slice of Mermaid's API this module uses. */
export interface MermaidLike {
  initialize(config: Record<string, unknown>): void;
  render(id: string, source: string): Promise<{ svg: string }>;
}

export interface MathOptions {
  /** Resolves KaTeX. Default: import it from a CDN and add its stylesheet. */
  load?: () => Promise<KatexLike | { default: KatexLike }>;
  /** CDN base for the default loader. Default `https://cdn.jsdelivr.net/npm/katex@0.16/dist`. */
  cdn?: string;
  /** Extra KaTeX options (`macros`, `trust`, …). `throwOnError` is always `false`. */
  katex?: Record<string, unknown>;
}

export interface MermaidOptions {
  /** Resolves Mermaid. Default: import it from a CDN. */
  load?: () => Promise<MermaidLike | { default: MermaidLike }>;
  /** URL of the Mermaid ES module for the default loader. */
  src?: string;
  /** Extra `mermaid.initialize` config. `startOnLoad` is always `false`. */
  config?: Record<string, unknown>;
}

const KATEX_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16/dist';
const MERMAID_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const MATH_SELECTOR = '.md-book-math:not(.md-book-math--rendered)';
const MERMAID_SELECTOR = '.md-book-mermaid';

/** One load per distinct loader: repeated page renders share the library, a different `load` gets its own. */
interface Cached<T> {
  key: unknown;
  promise: Promise<T>;
}
let katexCache: Cached<KatexLike | { default: KatexLike }> | undefined;
let mermaidCache: Cached<MermaidLike | { default: MermaidLike }> | undefined;
let diagramCounter = 0;

/** Typesets every not-yet-rendered `.md-book-math` element under `root`. */
export async function typesetMath(root: ParentNode, options: MathOptions = {}): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>(MATH_SELECTOR)];
  if (nodes.length === 0) return;

  let katex: KatexLike;
  const key = options.load ?? options.cdn ?? KATEX_CDN;
  try {
    if (katexCache?.key !== key) {
      katexCache = {
        key,
        promise: (options.load ?? (() => loadKatex(options.cdn ?? KATEX_CDN)))(),
      };
    }
    katex = unwrap(await katexCache.promise);
  } catch (err) {
    katexCache = undefined;
    console.warn('md-book: could not load KaTeX; math is shown as TeX source.', err);
    return;
  }

  for (const el of nodes) {
    const tex = el.textContent ?? '';
    try {
      katex.render(tex, el, {
        ...options.katex,
        displayMode: el.classList.contains('md-book-math--display'),
        throwOnError: false,
      });
      el.classList.add('md-book-math--rendered');
    } catch {
      // leave the TeX source visible
    }
  }
}

/**
 * Draws every `.md-book-mermaid` under `root`. The diagram source is kept in
 * `data-source` so the same nodes can be redrawn when the theme changes.
 */
export async function typesetDiagrams(
  root: ParentNode,
  theme: 'light' | 'dark',
  options: MermaidOptions = {},
): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>(MERMAID_SELECTOR)];
  if (nodes.length === 0) return;

  let mermaid: MermaidLike;
  const key = options.load ?? options.src ?? MERMAID_SRC;
  try {
    if (mermaidCache?.key !== key) {
      mermaidCache = {
        key,
        promise: (options.load ?? (() => importDefault<MermaidLike>(options.src ?? MERMAID_SRC)))(),
      };
    }
    mermaid = unwrap(await mermaidCache.promise);
  } catch (err) {
    mermaidCache = undefined;
    console.warn('md-book: could not load Mermaid; diagrams are shown as source.', err);
    return;
  }

  mermaid.initialize({
    securityLevel: 'strict',
    ...options.config,
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
  });

  for (const el of nodes) {
    const source = el.dataset.source ?? el.textContent ?? '';
    el.dataset.source = source;
    try {
      const { svg } = await mermaid.render(`md-book-diagram-${++diagramCounter}`, source);
      el.innerHTML = svg;
      el.classList.add('md-book-mermaid--rendered');
    } catch {
      document.getElementById(`dmd-book-diagram-${diagramCounter}`)?.remove(); // mermaid's error stub
      el.classList.add('md-book-mermaid--error');
      el.textContent = source;
    }
  }
}

async function loadKatex(cdn: string): Promise<KatexLike> {
  const base = cdn.replace(/\/$/, '');
  if (!document.querySelector('link[data-md-book-katex]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}/katex.min.css`;
    link.dataset.mdBookKatex = '';
    document.head.append(link);
  }
  return importDefault<KatexLike>(`${base}/katex.mjs`);
}

/** `import('katex')` yields a namespace whose API is on `.default`; accept either shape. */
function unwrap<T extends object>(mod: T | { default: T }): T {
  const inner = (mod as { default?: T }).default;
  return inner && typeof inner === 'object' ? inner : (mod as T);
}

async function importDefault<T extends object>(url: string): Promise<T> {
  return unwrap((await import(/* @vite-ignore */ url)) as T | { default: T });
}
