export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME_STORAGE_KEY = 'md-book-theme';

export interface ThemeControllerOptions {
  /** localStorage key for the persisted mode. */
  storageKey?: string;
  /** Mode to use when nothing is stored. Default `'system'`. */
  default?: ThemeMode;
  /** Element that carries the `data-theme` attribute. Default `<html>`. */
  root?: HTMLElement;
}

export interface ThemeChangeDetail {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

export interface ThemeController {
  /** The chosen mode (`'system'` follows the OS). */
  get(): ThemeMode;
  /** Force a mode and persist it. */
  set(mode: ThemeMode): void;
  /** Flip between light and dark based on what is currently shown. */
  toggle(): void;
  /** The theme actually applied right now. */
  resolved(): ResolvedTheme;
  /** Listen for changes; returns an unsubscribe function. */
  subscribe(listener: (detail: ThemeChangeDetail) => void): () => void;
  destroy(): void;
}

const MODES: ThemeMode[] = ['light', 'dark', 'system'];

/**
 * Applies and persists the site theme by toggling `data-theme` on `<html>`.
 * SSR-safe: returns an inert controller when there is no DOM.
 */
export function createThemeController(options: ThemeControllerOptions = {}): ThemeController {
  const storageKey = options.storageKey ?? DEFAULT_THEME_STORAGE_KEY;
  const fallback = options.default ?? 'system';

  if (typeof document === 'undefined') return inertController(fallback);

  const root = options.root ?? document.documentElement;
  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const listeners = new Set<(detail: ThemeChangeDetail) => void>();

  let mode: ThemeMode = readStored(storageKey) ?? fallback;

  const resolve = (): ResolvedTheme =>
    mode === 'system' ? (media?.matches ? 'dark' : 'light') : mode;

  const apply = (persist: boolean): void => {
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    if (persist) writeStored(storageKey, mode);

    const detail: ThemeChangeDetail = { mode, resolved: resolve() };
    for (const fn of listeners) fn(detail);
    root.dispatchEvent(new CustomEvent<ThemeChangeDetail>('md-book:themechange', { detail }));
  };

  const onMediaChange = () => {
    if (mode === 'system') apply(false);
  };
  media?.addEventListener?.('change', onMediaChange);

  apply(false);

  return {
    get: () => mode,
    resolved: resolve,
    set(next) {
      if (!MODES.includes(next) || next === mode) {
        if (next === mode) return;
        throw new Error(`md-book: invalid theme mode "${next}"`);
      }
      mode = next;
      apply(true);
    },
    toggle() {
      mode = resolve() === 'dark' ? 'light' : 'dark';
      apply(true);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      media?.removeEventListener?.('change', onMediaChange);
      listeners.clear();
    },
  };
}

/**
 * A tiny script to inline in `<head>` so the theme is set before first paint
 * (no flash of the wrong theme). Pass the same `storageKey` you give the
 * controller.
 */
export function themeInitScript(storageKey = DEFAULT_THEME_STORAGE_KEY): string {
  const key = JSON.stringify(storageKey);
  return `(function(){try{var m=localStorage.getItem(${key});if(m==="light"||m==="dark"){document.documentElement.setAttribute("data-theme",m);}}catch(e){}})();`;
}

function readStored(key: string): ThemeMode | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, mode: ThemeMode): void {
  try {
    localStorage.setItem(key, mode);
  } catch {
    // storage unavailable (private mode, disabled) — non-fatal
  }
}

function inertController(mode: ThemeMode): ThemeController {
  return {
    get: () => mode,
    resolved: () => (mode === 'dark' ? 'dark' : 'light'),
    set: () => undefined,
    toggle: () => undefined,
    subscribe: () => () => undefined,
    destroy: () => undefined,
  };
}
