export type Highlighter = (code: string, lang: string | null) => string | Promise<string>;

const LANG_CLASS = /(?:^|\s)language-([\w+-]+)/;

/** Wraps each `<pre><code>` in a figure with a copy-to-clipboard button. */
export function addCodeCopyButtons(root: ParentNode): void {
  for (const pre of root.querySelectorAll('pre')) {
    const code = pre.querySelector('code');
    if (!code || pre.closest('.md-book-code')) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'md-book-code';
    const lang = code.className.match(LANG_CLASS)?.[1];
    if (lang) wrapper.dataset.lang = lang;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-book-code__copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    button.addEventListener('click', () => {
      void copyText(code.textContent ?? '').then((ok) => {
        button.textContent = ok ? 'Copied' : 'Failed';
        button.classList.toggle('is-copied', ok);
        window.setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('is-copied');
        }, 2000);
      });
    });

    pre.replaceWith(wrapper);
    wrapper.append(button, pre);
  }
}

/** Runs a highlighter over every fenced code block, replacing its markup. */
export async function applyHighlight(root: ParentNode, highlight: Highlighter): Promise<void> {
  const blocks = [...root.querySelectorAll('pre > code')];
  await Promise.all(
    blocks.map(async (code) => {
      const lang = code.className.match(LANG_CLASS)?.[1] ?? null;
      try {
        const html = await highlight(code.textContent ?? '', lang);
        if (typeof html === 'string' && html.length > 0) {
          code.innerHTML = html;
          (code as HTMLElement).dataset.highlighted = 'true';
        }
      } catch {
        // Leave the plain code block in place on failure.
      }
    }),
  );
}

export interface ScrollSpyOptions {
  /** The scrollable content element containing the headings. */
  content: ParentNode;
  /** Heading ids in document order. */
  ids: string[];
  /** Called when the active heading changes (or null when none is active). */
  onActive: (id: string | null) => void;
  rootMargin?: string;
}

export interface ScrollSpy {
  disconnect: () => void;
}

/**
 * Tracks which heading is currently in view and reports its id. Degrades to a
 * no-op when IntersectionObserver is unavailable (e.g. SSR / old browsers).
 */
export function createScrollSpy(options: ScrollSpyOptions): ScrollSpy {
  if (typeof IntersectionObserver === 'undefined' || options.ids.length === 0) {
    options.onActive(options.ids[0] ?? null);
    return { disconnect: () => undefined };
  }

  const visible = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.id;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      const active = options.ids.find((id) => visible.has(id)) ?? null;
      options.onActive(active);
    },
    { rootMargin: options.rootMargin ?? '0px 0px -70% 0px', threshold: 0 },
  );

  for (const id of options.ids) {
    const el = (options.content as Element).querySelector?.(`#${cssEscape(id)}`);
    if (el) observer.observe(el);
  }
  return { disconnect: () => observer.disconnect() };
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, (c) => `\\${c}`);
}
