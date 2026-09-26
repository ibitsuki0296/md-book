import { escapeAttr, escapeText } from './head.js';

export interface SitemapEntry {
  /** Absolute URL. */
  loc: string;
  /** ISO date / datetime. */
  lastmod?: string;
  /** Translations of this page (`xhtml:link rel="alternate"`). */
  alternates?: Array<{ hreflang: string; href: string }>;
}

/** Serialises a `sitemap.xml` document. Pure. */
export function generateSitemap(entries: SitemapEntry[]): string {
  const localised = entries.some((e) => e.alternates && e.alternates.length > 0);
  const xhtml = localised ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : '';
  const urls = entries.map((e) => {
    const lines = [`<loc>${escapeText(e.loc)}</loc>`];
    if (e.lastmod) lines.push(`<lastmod>${escapeText(e.lastmod)}</lastmod>`);
    for (const alt of e.alternates ?? []) {
      lines.push(
        `<xhtml:link rel="alternate" hreflang="${escapeAttr(alt.hreflang)}" href="${escapeAttr(alt.href)}"/>`,
      );
    }
    return `  <url>\n    ${lines.join('\n    ')}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xhtml}>\n${urls.join('\n')}\n</urlset>\n`;
}
