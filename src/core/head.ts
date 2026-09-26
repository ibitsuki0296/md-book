/**
 * Page `<head>` metadata as data: `<title>`, description / canonical / Open Graph
 * / Twitter tags, hreflang alternates and Article JSON-LD. The runtime reconciles
 * these into the live document; the SSG serialises them into static HTML.
 * Pure and DOM-free.
 */

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

export interface HeadAlternate {
  /** BCP-47 code, or `x-default`. */
  hreflang: string;
  /** Route path of that translation. */
  route: string;
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
  /** Translations of this page, emitted as `<link rel="alternate" hreflang>`. */
  alternates?: HeadAlternate[];
}

export interface HeadTag {
  tag: 'meta' | 'link';
  /** Identifying attributes (`name` / `property` / `rel` + `hreflang`). */
  attrs: Record<string, string>;
  /** The `content` (meta) or `href` (link) value. */
  value: string;
}

export interface HeadData {
  title: string;
  tags: HeadTag[];
  /** Serialised Article JSON-LD, or undefined when none applies. */
  jsonLd?: string;
}

export interface HeadContext {
  /** Origin used for absolute URLs when `config.siteUrl` is not set (`location.origin`). */
  origin?: string;
}

export function buildHead(
  input: HeadInput,
  config: SeoConfig,
  context: HeadContext = {},
): HeadData {
  const url = absoluteUrl(input.routePath, config.siteUrl, context.origin);
  const image = input.image
    ? absoluteAsset(input.image, config.siteUrl, context.origin)
    : config.defaultImage
      ? absoluteAsset(config.defaultImage, config.siteUrl, context.origin)
      : undefined;

  const tags: HeadTag[] = [];
  const meta = (key: 'name' | 'property', name: string, value: string) =>
    tags.push({ tag: 'meta', attrs: { [key]: name }, value });

  meta('name', 'description', input.description);
  tags.push({ tag: 'link', attrs: { rel: 'canonical' }, value: url });
  for (const alt of input.alternates ?? []) {
    tags.push({
      tag: 'link',
      attrs: { rel: 'alternate', hreflang: alt.hreflang },
      value: absoluteUrl(alt.route, config.siteUrl, context.origin),
    });
  }
  meta('property', 'og:type', input.type);
  meta('property', 'og:title', input.title);
  meta('property', 'og:description', input.description);
  meta('property', 'og:url', url);
  if (config.siteName) meta('property', 'og:site_name', config.siteName);
  if (input.locale) meta('property', 'og:locale', input.locale);
  if (image) meta('property', 'og:image', image);
  meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  if (config.twitterSite) meta('name', 'twitter:site', config.twitterSite);
  meta('name', 'twitter:title', input.title);
  meta('name', 'twitter:description', input.description);
  if (image) meta('name', 'twitter:image', image);
  if (input.type === 'article') {
    if (input.publishedTime) meta('property', 'article:published_time', input.publishedTime);
    if (input.modifiedTime) meta('property', 'article:modified_time', input.modifiedTime);
    if (input.author) meta('property', 'article:author', input.author);
    for (const tag of input.tags ?? []) meta('property', 'article:tag', tag);
  }

  let jsonLd: string | undefined;
  if (input.type === 'article' && config.jsonLd !== false) {
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
    jsonLd = JSON.stringify(data);
  }

  return { title: input.title, tags, jsonLd };
}

/** Serialises head data as HTML (for static pages). Attribute values are escaped. */
export function headToHTML(head: HeadData): string {
  const lines = [`<title>${escapeText(head.title)}</title>`];
  for (const { tag, attrs, value } of head.tags) {
    const identity = Object.entries(attrs)
      .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
      .join(' ');
    const valueAttr = tag === 'link' ? 'href' : 'content';
    lines.push(`<${tag} ${identity} ${valueAttr}="${escapeAttr(value)}">`);
  }
  if (head.jsonLd) {
    // `<` is escaped so a `</script>` inside a value cannot end the block.
    lines.push(
      `<script type="application/ld+json">${head.jsonLd.replace(/</g, '\\u003c')}</script>`,
    );
  }
  return lines.join('\n');
}

export function absoluteUrl(routePath: string, siteUrl?: string, origin?: string): string {
  if (siteUrl) return new URL(routePath.replace(/^\//, ''), ensureSlash(siteUrl)).toString();
  if (origin) return new URL(routePath, origin).toString();
  return routePath;
}

function absoluteAsset(asset: string, siteUrl?: string, origin?: string): string {
  if (/^https?:\/\//i.test(asset)) return asset;
  return absoluteUrl(asset.startsWith('/') ? asset : `/${asset}`, siteUrl, origin);
}

function ensureSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
