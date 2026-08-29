import type { FrontMatter } from './types.js';

/** Current manifest schema version. Bump on breaking shape changes. */
export const MANIFEST_VERSION = 1 as const;

/** One page discovered by the manifest generator. */
export interface ManifestEntry {
  /** Source path relative to the content root, POSIX separators, e.g. `guide/intro.md`. */
  file: string;
  /** Route path, e.g. `/guide/intro`. `index.md` / `README.md` map to their directory. */
  path: string;
  /** Parsed front matter (empty object when the file has none). */
  frontMatter: FrontMatter;
  /** Resolved sort key: front matter `order`, else a numeric filename prefix, else undefined. */
  order?: number;
  /** Source last-modified time in epoch ms, when the generator provides it. */
  mtime?: number;
}

export interface Manifest {
  version: typeof MANIFEST_VERSION;
  /** Site base path, `/` or e.g. `/docs/`. */
  base: string;
  /** Optional URL prefix the runtime prepends when fetching raw `.md` files. */
  contentBase?: string;
  entries: ManifestEntry[];
  /** ISO timestamp of generation. */
  generatedAt: string;
}

/** A node in the resolved route tree. Intermediate directories appear even with no own page. */
export interface RouteNode {
  /** Full route path, e.g. `/guide`. */
  path: string;
  /** Last path segment, e.g. `guide`. Empty string for the root. */
  segment: string;
  /** The page located exactly at `path`, if one exists. */
  entry?: ManifestEntry;
  children: RouteNode[];
  /** Resolved sort key: lower sorts first; ties break on title then segment. */
  order?: number;
  /** Display title (front matter → prettified segment). */
  title: string;
}

export interface NavItem {
  text: string;
  link: string;
}

export interface SidebarOptions {
  /** Restrict the sidebar to the subtree under this route, e.g. `/guide`. Default: whole site. */
  section?: string;
  /** Include entries whose front matter has `draft: true`. Default `false`. */
  includeDrafts?: boolean;
}

/** `YYYY-MM-DD-` blog-style date prefix: stripped from slugs, never used as a sort key. */
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}[-_.]\s?/;
/** Short `NN-` ordering prefix: stripped from slugs and used as the sibling sort key. */
const ORDER_PREFIX = /^(\d{1,3})[-_.]\s?/;
const MD_EXT = /\.(?:md|markdown)$/i;

function stripPrefixes(segment: string): string {
  return segment.replace(DATE_PREFIX, '').replace(ORDER_PREFIX, '');
}

/**
 * Derives a route path from a content-relative file path.
 * Strips the extension and any `NN-` ordering prefix per segment, and maps
 * `index` / `readme` basenames to their parent directory.
 */
export function fileToRoutePath(file: string, base = '/'): string {
  const clean = file.replace(/\\/g, '/').replace(/^\.?\//, '');
  const withoutExt = clean.replace(MD_EXT, '');
  const segments = withoutExt
    .split('/')
    .filter((s) => s.length > 0)
    .map(stripPrefixes);

  const last = segments[segments.length - 1]?.toLowerCase();
  if (last === 'index' || last === 'readme') segments.pop();

  return joinRoute(base, segments);
}

/**
 * Numeric ordering prefix of a file's basename, if present (`03-setup.md` → 3).
 * A `YYYY-MM-DD-` blog date prefix is deliberately ignored — blog ordering is
 * driven by the front matter `date`, not the filename.
 */
export function orderFromFilename(file: string): number | undefined {
  const basename = file.replace(/\\/g, '/').split('/').pop() ?? '';
  if (DATE_PREFIX.test(basename)) return undefined;
  const match = basename.match(ORDER_PREFIX);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
}

/** Builds a {@link ManifestEntry}, resolving the route path and sort key. */
export function makeEntry(
  file: string,
  frontMatter: FrontMatter,
  base = '/',
  mtime?: number,
): ManifestEntry {
  const slug = typeof frontMatter.slug === 'string' ? frontMatter.slug : undefined;
  const path = slug ? applySlug(file, slug, base) : fileToRoutePath(file, base);
  const order = typeof frontMatter.order === 'number' ? frontMatter.order : orderFromFilename(file);
  return { file: file.replace(/\\/g, '/'), path, frontMatter, order, mtime };
}

/** Human-readable title for an entry: front matter `title` → prettified last route segment. */
export function entryTitle(entry: ManifestEntry): string {
  const fmTitle = entry.frontMatter.title;
  if (typeof fmTitle === 'string' && fmTitle.trim().length > 0) return fmTitle.trim();
  const segment = entry.path.split('/').filter(Boolean).pop() ?? 'Home';
  return prettifySegment(segment);
}

/** Resolves a flat entry list into a nested route tree rooted at `/`. */
export function resolveRoutes(entries: ManifestEntry[]): RouteNode {
  const root: RouteNode = { path: '/', segment: '', children: [], title: 'Home' };

  for (const entry of entries) {
    const segments = entry.path.split('/').filter(Boolean);
    let node = root;
    let acc = '';
    for (const segment of segments) {
      acc += `/${segment}`;
      let child = node.children.find((c) => c.segment === segment);
      if (!child) {
        child = { path: acc, segment, children: [], title: prettifySegment(segment) };
        node.children.push(child);
      }
      node = child;
    }
    node.entry = entry;
    node.order = entry.order;
    node.title = entryTitle(entry);
  }

  sortTree(root);
  return root;
}

/** Top-level navigation: one item per first-level section, linking to its landing page. */
export function buildNav(entries: ManifestEntry[]): NavItem[] {
  const root = resolveRoutes(entries);
  return root.children.map((node) => ({
    text: node.title,
    link: firstLink(node) ?? node.path,
  }));
}

/** Sidebar tree (as {@link RouteNode}s) for the whole site or a single section. */
export function buildSidebar(entries: ManifestEntry[], options: SidebarOptions = {}): RouteNode[] {
  const visible = options.includeDrafts
    ? entries
    : entries.filter((e) => e.frontMatter.draft !== true);
  const root = resolveRoutes(visible);
  if (!options.section || options.section === '/') return root.children;
  const target = findNode(root, options.section);
  return target ? target.children : [];
}

/** Depth-first ordered list of pages (nodes that have an entry), honouring the tree sort. */
export function flattenPages(nodes: RouteNode[]): ManifestEntry[] {
  const out: ManifestEntry[] = [];
  const walk = (list: RouteNode[]) => {
    for (const node of list) {
      if (node.entry) out.push(node.entry);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export interface PrevNext {
  prev?: { path: string; title: string };
  next?: { path: string; title: string };
}

/** Previous / next page links for `currentPath` within an ordered page list. */
export function getPrevNext(pages: ManifestEntry[], currentPath: string): PrevNext {
  const idx = pages.findIndex((p) => p.path === currentPath);
  if (idx === -1) return {};
  const result: PrevNext = {};
  const prev = pages[idx - 1];
  const next = pages[idx + 1];
  if (prev) result.prev = { path: prev.path, title: entryTitle(prev) };
  if (next) result.next = { path: next.path, title: entryTitle(next) };
  return result;
}

/** Validates the shape of a parsed manifest, throwing on the first problem. */
export function assertManifest(value: unknown): asserts value is Manifest {
  if (typeof value !== 'object' || value === null) throw new Error('manifest: not an object');
  const m = value as Record<string, unknown>;
  if (m.version !== MANIFEST_VERSION) {
    throw new Error(
      `manifest: unsupported version ${String(m.version)} (expected ${MANIFEST_VERSION})`,
    );
  }
  if (typeof m.base !== 'string') throw new Error('manifest: `base` must be a string');
  if (!Array.isArray(m.entries)) throw new Error('manifest: `entries` must be an array');
  for (const [i, raw] of m.entries.entries()) {
    const e = raw as Record<string, unknown>;
    if (typeof e.file !== 'string')
      throw new Error(`manifest: entries[${i}].file must be a string`);
    if (typeof e.path !== 'string')
      throw new Error(`manifest: entries[${i}].path must be a string`);
    if (typeof e.frontMatter !== 'object' || e.frontMatter === null) {
      throw new Error(`manifest: entries[${i}].frontMatter must be an object`);
    }
  }
}

// --- internals -------------------------------------------------------------

function applySlug(file: string, slug: string, base: string): string {
  if (slug.startsWith('/')) return joinRoute(base, slug.split('/').filter(Boolean));
  const parent = fileToRoutePath(file, '/').split('/').filter(Boolean).slice(0, -1);
  return joinRoute(base, [...parent, ...slug.split('/').filter(Boolean)]);
}

function joinRoute(base: string, segments: string[]): string {
  const prefix = base === '/' || base === '' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  const path = segments.length === 0 ? '' : `/${segments.join('/')}`;
  return `${prefix}${path}` || '/';
}

function prettifySegment(segment: string): string {
  if (segment.length === 0) return 'Home';
  return stripPrefixes(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortTree(node: RouteNode): void {
  node.children.sort(compareNodes);
  for (const child of node.children) sortTree(child);
}

function compareNodes(a: RouteNode, b: RouteNode): number {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  const byTitle = a.title.localeCompare(b.title);
  return byTitle !== 0 ? byTitle : a.segment.localeCompare(b.segment);
}

function findNode(root: RouteNode, path: string): RouteNode | undefined {
  const segments = path.split('/').filter(Boolean);
  let node: RouteNode | undefined = root;
  for (const segment of segments) {
    node = node?.children.find((c) => c.segment === segment);
    if (!node) return undefined;
  }
  return node;
}

function firstLink(node: RouteNode): string | undefined {
  if (node.entry) return node.entry.path;
  for (const child of node.children) {
    const link = firstLink(child);
    if (link) return link;
  }
  return undefined;
}
