/** `localStorage` key the theme controller persists the chosen mode under. */
export const DEFAULT_THEME_STORAGE_KEY = 'md-book-theme';

/**
 * A tiny script to inline in `<head>` so the theme is set before first paint
 * (no flash of the wrong theme). Pass the same `storageKey` you give the
 * controller.
 */
export function themeInitScript(storageKey = DEFAULT_THEME_STORAGE_KEY): string {
  const key = JSON.stringify(storageKey);
  return `(function(){try{var m=localStorage.getItem(${key});if(m==="light"||m==="dark"){document.documentElement.setAttribute("data-theme",m);}}catch(e){}})();`;
}
