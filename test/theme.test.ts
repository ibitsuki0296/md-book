// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThemeController, themeInitScript } from '../src/runtime/index.js';

const KEY = 'md-book-theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('createThemeController', () => {
  it('defaults to system mode with no data-theme attribute', () => {
    const c = createThemeController();
    expect(c.get()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    c.destroy();
  });

  it('reads a persisted mode on creation', () => {
    localStorage.setItem(KEY, 'dark');
    const c = createThemeController();
    expect(c.get()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    c.destroy();
  });

  it('set() updates the attribute, storage, event and subscribers', () => {
    const c = createThemeController();
    const seen: string[] = [];
    c.subscribe((d) => seen.push(d.mode));
    const events: string[] = [];
    document.documentElement.addEventListener('md-book:themechange', (e) => {
      events.push((e as CustomEvent).detail.mode);
    });

    c.set('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(seen).toEqual(['light']);
    expect(events).toEqual(['light']);
    c.destroy();
  });

  it('toggle() flips between light and dark', () => {
    const c = createThemeController({ default: 'light' });
    c.toggle();
    expect(c.get()).toBe('dark');
    c.toggle();
    expect(c.get()).toBe('light');
    c.destroy();
  });

  it('rejects an invalid mode', () => {
    const c = createThemeController();
    // @ts-expect-error deliberately wrong
    expect(() => c.set('sepia')).toThrow(/invalid theme mode/);
    c.destroy();
  });

  it('stops reacting after destroy', () => {
    const c = createThemeController();
    const fn = vi.fn();
    c.subscribe(fn);
    c.destroy();
    c.set('dark');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('themeInitScript', () => {
  it('embeds the storage key and applies a stored theme before paint', () => {
    expect(themeInitScript('custom-key')).toContain('"custom-key"');
    localStorage.setItem(KEY, 'dark');
    new Function(themeInitScript())();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(KEY, 'bogus');
    new Function(themeInitScript())();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
