import { type Dirent, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { MANIFEST_VERSION, type Manifest, type ManifestEntry, makeEntry } from '../core/content.js';
import { parseFrontMatter } from '../core/frontmatter.js';
import { type LocaleConfig, localeOfRoute, normalizeLocales } from '../core/locale.js';
import type { FrontMatter } from '../core/types.js';

export interface GenerateManifestOptions {
  /** Directory to scan for Markdown files. */
  contentDir: string;
  /** Site base path baked into every route. Default `/`. */
  base?: string;
  /** URL prefix the runtime prepends when fetching raw `.md`. */
  contentBase?: string;
  /** Site title / description baked into the manifest for the runtime. */
  title?: string;
  description?: string;
  /** Include files whose front matter has `draft: true`. Default `false`. */
  includeDrafts?: boolean;
  /** Directory / file names to skip entirely. */
  ignore?: string[];
  /**
   * Content-level i18n. The default locale lives at the content root, every
   * other locale in a directory named after its code (`ja/guide/intro.md` →
   * `/ja/guide/intro`). Codes or `{ code, label, title, description }` objects.
   */
  locales?: ReadonlyArray<string | LocaleConfig>;
  /** Default locale code. Defaults to the first locale. */
  defaultLocale?: string;
}

const MD_FILE = /\.(?:md|markdown)$/i;
const DEFAULT_IGNORE = ['node_modules', '.git', '.svn', 'dist', 'coverage'];

/** Scans `contentDir` and builds an in-memory {@link Manifest}. Pure w.r.t. output (no writes). */
export function generateManifest(options: GenerateManifestOptions): Manifest {
  const base = options.base ?? '/';
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.ignore ?? [])]);
  const files = walk(options.contentDir, options.contentDir, ignore).sort();

  const setup = normalizeLocales(options.locales, options.defaultLocale);
  const entries: ManifestEntry[] = [];
  for (const file of files) {
    const abs = join(options.contentDir, file);
    const raw = readFileSync(abs, 'utf8');
    const frontMatter = parseFrontMatter(raw).data as FrontMatter;
    if (frontMatter.draft === true && !options.includeDrafts) continue;
    const mtime = safeMtime(abs);
    const entry = makeEntry(toPosix(file), frontMatter, base, mtime);
    if (setup) entry.locale = localeOfRoute(stripBase(entry.path, base), setup);
    entries.push(entry);
  }

  entries.sort((a, b) => a.path.localeCompare(b.path) || a.file.localeCompare(b.file));

  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    base,
    entries,
    generatedAt: new Date().toISOString(),
  };
  if (setup) {
    manifest.locales = setup.locales;
    manifest.defaultLocale = setup.defaultLocale;
  }
  if (options.contentBase) manifest.contentBase = options.contentBase;
  if (options.title) manifest.title = options.title;
  if (options.description) manifest.description = options.description;
  return manifest;
}

/** Generates a manifest and writes it as pretty JSON, returning the entry count. */
export function writeManifest(options: GenerateManifestOptions & { out: string }): {
  manifest: Manifest;
  written: string;
} {
  const manifest = generateManifest(options);
  writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, written: options.out };
}

function stripBase(path: string, base: string): string {
  const prefix = base === '/' || base === '' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  if (!prefix) return path;
  if (path === prefix) return '/';
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
}

function walk(root: string, dir: string, ignore: Set<string>): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ignore.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(root, abs, ignore));
    } else if (entry.isFile() && MD_FILE.test(entry.name)) {
      out.push(relative(root, abs));
    }
  }
  return out;
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

function safeMtime(abs: string): number | undefined {
  try {
    return Math.round(statSync(abs).mtimeMs);
  } catch {
    return undefined;
  }
}
