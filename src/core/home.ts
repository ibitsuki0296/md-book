import type { FrontMatter, HomeAction, HomeFeature } from './types.js';

/** Turns a front-matter `link` into an href; only called for in-site route paths. */
export type HrefResolver = (link: string) => string;

const EXTERNAL = /^(?:https?:)?\/\//i;
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Renders the landing-page blocks (`hero` + `features`) for a `layout: home`
 * page as an HTML fragment. Everything is escaped; unsafe link schemes such as
 * `javascript:` are dropped. Pure and DOM-free, so an SSG layer can reuse it.
 */
export function renderHome(frontMatter: FrontMatter, resolveHref: HrefResolver = (l) => l): string {
  return [
    renderHero(frontMatter.hero, resolveHref),
    renderFeatures(frontMatter.features, resolveHref),
  ]
    .filter(Boolean)
    .join('\n');
}

function renderHero(hero: FrontMatter['hero'], resolveHref: HrefResolver): string {
  if (!isRecord(hero)) return '';
  const name = str(hero.name);
  const text = str(hero.text);
  const tagline = str(hero.tagline);
  const actions = (Array.isArray(hero.actions) ? hero.actions : [])
    .filter((a): a is HomeAction => isRecord(a) && !!str(a.text) && !!str(a.link))
    .map((a, i) => {
      const theme = a.theme === 'alt' || (a.theme !== 'brand' && i > 0) ? 'alt' : 'brand';
      return `<a class="md-book-hero__action md-book-hero__action--${theme}"${hrefAttr(a.link, resolveHref)}>${esc(a.text)}</a>`;
    });
  if (!name && !text && !tagline && actions.length === 0) return '';

  return [
    '<section class="md-book-hero">',
    name ? `<h1 class="md-book-hero__name">${esc(name)}</h1>` : '',
    text ? `<p class="md-book-hero__text">${esc(text)}</p>` : '',
    tagline ? `<p class="md-book-hero__tagline">${inline(tagline)}</p>` : '',
    actions.length > 0 ? `<div class="md-book-hero__actions">${actions.join('')}</div>` : '',
    '</section>',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderFeatures(features: FrontMatter['features'], resolveHref: HrefResolver): string {
  if (!Array.isArray(features)) return '';
  const cards = features
    .filter((f): f is HomeFeature => isRecord(f) && !!str(f.title))
    .map((f) => {
      const inner = [
        f.icon
          ? `<span class="md-book-feature__icon" aria-hidden="true">${esc(str(f.icon))}</span>`
          : '',
        `<h2 class="md-book-feature__title">${esc(str(f.title))}</h2>`,
        f.details ? `<p class="md-book-feature__details">${inline(str(f.details))}</p>` : '',
      ].join('');
      const href = f.link ? hrefAttr(f.link, resolveHref) : '';
      return href
        ? `<a class="md-book-feature md-book-feature--link"${href}>${inner}</a>`
        : `<div class="md-book-feature">${inner}</div>`;
    });
  return cards.length > 0 ? `<div class="md-book-features">${cards.join('')}</div>` : '';
}

/** ` href="…"` for a safe link, or an empty string when the scheme is not allowed. */
function hrefAttr(link: unknown, resolveHref: HrefResolver): string {
  const value = str(link).trim();
  if (!value) return '';
  if (EXTERNAL.test(value)) return ` href="${esc(value)}" rel="noopener noreferrer"`;
  if (value.startsWith('#') || /^mailto:/i.test(value)) return ` href="${esc(value)}"`;
  if (OTHER_SCHEME.test(value)) return ''; // javascript:, data:, … — not allowed
  return ` href="${esc(resolveHref(value))}"`;
}

/** Escapes text, then turns `code` spans into `<code>`. */
function inline(text: string): string {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
