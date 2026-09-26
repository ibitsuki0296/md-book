import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryTitle } from '../core/content.js';
import {
  type ExtractOptions,
  type SearchIndex,
  createSearchIndex,
  extractSearchDoc,
} from '../core/search.js';
import { type GenerateManifestOptions, generateManifest } from './manifest.js';

export interface GenerateSearchIndexOptions
  extends Pick<
    GenerateManifestOptions,
    'contentDir' | 'includeDrafts' | 'ignore' | 'locales' | 'defaultLocale'
  > {
  /** Cap on body characters kept per page (`0` = unlimited). Default 8000. */
  maxChars?: number;
  /** Markdown features to parse with (must match what the site renders). */
  render?: ExtractOptions['render'];
}

/**
 * Builds a search index over a content directory. Routes are relative to the
 * site base (what the runtime router reports), whatever `--base` the manifest uses.
 */
export function generateSearchIndex(options: GenerateSearchIndexOptions): SearchIndex {
  const manifest = generateManifest({ ...options, base: '/' });
  return createSearchIndex(
    manifest.entries.map((entry) =>
      extractSearchDoc(
        readFileSync(join(options.contentDir, entry.file), 'utf8'),
        { path: entry.path, title: entryTitle(entry), locale: entry.locale },
        { maxChars: options.maxChars, render: options.render },
      ),
    ),
  );
}

export function writeSearchIndex(options: GenerateSearchIndexOptions & { out: string }): {
  index: SearchIndex;
  written: string;
} {
  const index = generateSearchIndex(options);
  writeFileSync(options.out, `${JSON.stringify(index)}\n`, 'utf8');
  return { index, written: options.out };
}
