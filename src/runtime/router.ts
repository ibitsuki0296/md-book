export type RouterMode = 'history' | 'hash';

export interface RouterOptions {
  /** Site base path, e.g. `/` or `/docs/`. */
  base?: string;
  mode?: RouterMode;
  /** Called on initial load and every subsequent navigation. */
  onNavigate: (path: string, context: { hash: string; replace: boolean }) => void;
}

export interface Router {
  /** Current route path (base-stripped, no hash). */
  readonly current: string;
  /** Navigate to a route path (may include `#hash`). */
  navigate: (to: string, options?: { replace?: boolean }) => void;
  /** Resolve a route path to an href for the current mode (for `<a href>`). */
  href: (to: string) => string;
  /** Begin intercepting clicks + popstate and fire the first `onNavigate`. */
  start: () => void;
  stop: () => void;
}

/** Creates a client-side router over the History API (or hash routing). */
export function createRouter(options: RouterOptions): Router {
  const mode: RouterMode = options.mode ?? 'history';
  const base = normalizeBase(options.base ?? '/');
  let current = '/';
  let started = false;

  const readLocation = (): { path: string; hash: string } => {
    if (mode === 'hash') {
      const raw = window.location.hash.replace(/^#/, '') || '/';
      const [path, hash = ''] = raw.split('#');
      return { path: ensureLeading(path || '/'), hash };
    }
    const path = stripBase(window.location.pathname, base);
    return { path: ensureLeading(path), hash: window.location.hash.replace(/^#/, '') };
  };

  const href = (to: string): string => {
    const [path, hash] = splitHash(to);
    const routePath = ensureLeading(path || current);
    if (mode === 'hash') return `#${routePath}${hash ? `#${hash}` : ''}`;
    const withBase = base === '/' ? routePath : `${base}${routePath === '/' ? '' : routePath}`;
    return `${withBase}${hash ? `#${hash}` : ''}`;
  };

  const emit = (replace: boolean) => {
    const { path, hash } = readLocation();
    current = path;
    options.onNavigate(path, { hash, replace });
  };

  const navigate: Router['navigate'] = (to, opts = {}) => {
    const target = href(to);
    const [path] = splitHash(to);
    if (opts.replace) window.history.replaceState({}, '', target);
    else window.history.pushState({}, '', target);
    current = ensureLeading(path || current);
    emit(Boolean(opts.replace));
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor) return;
    const href2 = anchor.getAttribute('href');
    if (!href2 || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if (anchor.hasAttribute('data-md-book-external') || /^[a-z]+:/i.test(href2)) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    if (mode === 'hash') {
      if (!href2.startsWith('#')) return;
      event.preventDefault();
      navigate(href2.slice(1));
      return;
    }
    if (!url.pathname.startsWith(base === '/' ? '/' : base)) return;
    event.preventDefault();
    const path = stripBase(url.pathname, base);
    navigate(`${path}${url.hash}`);
  };

  const onPopState = () => emit(false);

  return {
    get current() {
      return current;
    },
    navigate,
    href,
    start() {
      if (started) return;
      started = true;
      document.addEventListener('click', onClick as EventListener);
      window.addEventListener('popstate', onPopState);
      emit(true);
    },
    stop() {
      started = false;
      document.removeEventListener('click', onClick as EventListener);
      window.removeEventListener('popstate', onPopState);
    },
  };
}

// --- helpers -------------------------------------------------------------

function normalizeBase(base: string): string {
  if (base === '' || base === '/') return '/';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

function ensureLeading(path: string): string {
  const clean = path.replace(/\/{2,}/g, '/');
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function stripBase(pathname: string, base: string): string {
  if (base === '/') return pathname || '/';
  return pathname === base || pathname === `${base}/`
    ? '/'
    : pathname.startsWith(`${base}/`)
      ? pathname.slice(base.length)
      : pathname;
}

function splitHash(to: string): [string, string] {
  const idx = to.indexOf('#');
  return idx === -1 ? [to, ''] : [to.slice(0, idx), to.slice(idx + 1)];
}
