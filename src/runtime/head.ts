export interface SeoConfig {
  /** Absolute site origin + base, e.g. `https://example.com/docs/`. */
  siteUrl?: string;
  /** Site name for `og:site_name`. */
  siteName?: string;
  /** Fallback social image (absolute or site-relative). */
  defaultImage?: string;
  /** `@handle` for `twitter:site`. */
  twitterSite?: string;
  /** Emit Article JSON-LD for pages that have a date. Default `true`. */
  jsonLd?: boolean;
}

export interface HeadInput {
  title: string;
  description: string;
  /** Route path of the current page, e.g. `/guide/intro`. */
  routePath: string;
  /** `article` for blog posts, else `website`. */
  type: 'website' | 'article';
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  /** UI locale, emitted as `og:locale` when set. */
  locale?: string;
}

const MANAGED_ATTR = 'data-md-book-head';

/**
 * Reconciles `<title>` and the document's social / canonical meta with the
 * current page. Only tags it created are touched, so hand-authored `<head>`
 * content is left alone.
 */
export function applyHead(input: HeadInput, config: SeoConfig): void {
  if (typeof document === 'undefined') return;

  document.title = input.title;

  const url = absoluteUrl(input.routePath, config.siteUrl);
  const image = input.image
    ? absoluteAsset(input.image, config.siteUrl)
    : config.defaultImage
      ? absoluteAsset(config.defaultImage, config.siteUrl)
      : undefined;

  const tags: Array<[Record<string, string>, string]> = [
    [{ name: 'description' }, input.description],
    [{ rel: 'canonical' }, url],
    [{ property: 'og:type' }, input.type],
    [{ property: 'og:title' }, input.title],
    [{ property: 'og:description' }, input.description],
    [{ property: 'og:url' }, url],
  ];
  if (config.siteName) tags.push([{ property: 'og:site_name' }, config.siteName]);
  if (input.locale) tags.push([{ property: 'og:locale' }, input.locale]);
  if (image) tags.push([{ property: 'og:image' }, image]);
  tags.push([{ name: 'twitter:card' }, image ? 'summary_large_image' : 'summary']);
  if (config.twitterSite) tags.push([{ name: 'twitter:site' }, config.twitterSite]);
  tags.push([{ name: 'twitter:title' }, input.title]);
  tags.push([{ name: 'twitter:description' }, input.description]);
  if (image) tags.push([{ name: 'twitter:image' }, image]);
  if (input.type === 'article') {
    if (input.publishedTime)
      tags.push([{ property: 'article:published_time' }, input.publishedTime]);
    if (input.modifiedTime) tags.push([{ property: 'article:modified_time' }, input.modifiedTime]);
    if (input.author) tags.push([{ property: 'article:author' }, input.author]);
    for (const tag of input.tags ?? []) tags.push([{ property: 'article:tag' }, tag]);
  }

  const seen: Element[] = [];
  for (const [selectorAttrs, value] of tags) {
    seen.push(upsert(selectorAttrs, value));
  }
  pruneStale(seen, 'meta,link');

  if (config.jsonLd !== false) applyJsonLd(input, url, config, image);
}

function upsert(attrs: Record<string, string>, value: string): Element {
  const isLink = 'rel' in attrs;
  const selector = Object.entries(attrs)
    .map(([k, v]) => `[${k}="${v}"]`)
    .join('');
  let el = document.head.querySelector(`${isLink ? 'link' : 'meta'}${selector}`);
  if (!el) {
    el = document.createElement(isLink ? 'link' : 'meta');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute(MANAGED_ATTR, '');
  el.setAttribute(isLink ? 'href' : 'content', value);
  return el;
}

function pruneStale(keep: Element[], selector: string): void {
  for (const el of document.head.querySelectorAll(`${selector}[${MANAGED_ATTR}]`)) {
    if (!keep.includes(el) && el.getAttribute('type') !== 'application/ld+json') el.remove();
  }
}

function applyJsonLd(
  input: HeadInput,
  url: string,
  config: SeoConfig,
  image: string | undefined,
): void {
  let script = document.head.querySelector<HTMLScriptElement>(
    `script[type="application/ld+json"][${MANAGED_ATTR}]`,
  );

  if (input.type !== 'article') {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(MANAGED_ATTR, '');
    document.head.appendChild(script);
  }
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    mainEntityOfPage: url,
    url,
  };
  if (input.publishedTime) data.datePublished = input.publishedTime;
  if (input.modifiedTime) data.dateModified = input.modifiedTime;
  if (input.author) data.author = { '@type': 'Person', name: input.author };
  if (config.siteName) data.publisher = { '@type': 'Organization', name: config.siteName };
  if (image) data.image = image;
  script.textContent = JSON.stringify(data);
}

function absoluteUrl(routePath: string, siteUrl?: string): string {
  if (siteUrl) return new URL(routePath.replace(/^\//, ''), ensureSlash(siteUrl)).toString();
  if (typeof location !== 'undefined') return new URL(routePath, location.origin).toString();
  return routePath;
}

function absoluteAsset(asset: string, siteUrl?: string): string {
  if (/^https?:\/\//i.test(asset)) return asset;
  return absoluteUrl(asset.startsWith('/') ? asset : `/${asset}`, siteUrl);
}

function ensureSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
