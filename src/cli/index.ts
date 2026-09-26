import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { LocaleConfig } from '../core/locale.js';
import { version } from '../version.js';
import { buildSite } from './build.js';
import { startDevServer } from './dev.js';
import { writeFeeds } from './feed.js';
import { writeManifest } from './manifest.js';
import { writeSearchIndex } from './search.js';

const HELP = `md-book — Markdown documentation & blog toolkit

Usage:
  md-book manifest <contentDir> [options]   Scan Markdown files into manifest.json
  md-book search-index <contentDir> [opts]  Build search-index.json for the search box
  md-book feed <contentDir> [options]       Generate RSS / Atom / JSON blog feeds
  md-book build <contentDir> [options]      Pre-render a fully static site (SSG)
  md-book dev [options]                     Serve a site with live reload

manifest options:
  --out <file>          Output path (default: <contentDir>/manifest.json)
  --base <path>         Site base path baked into routes (default: /)
  --content-base <url>  URL prefix the runtime uses to fetch raw .md
  --title <text>        Site title stored in the manifest
  --description <text>  Site description stored in the manifest
  --drafts             Include pages with front matter draft: true
  --locales <list>      Content locales, e.g. en,ja or en:English,ja:日本語. The default
                        locale lives at the content root, the others in <code>/ dirs
  --default-locale <c>  Default locale code (default: the first of --locales)

search-index options:
  --out <file>          Output path (default: <contentDir>/search-index.json)
  --max-chars <n>       Body characters kept per page, 0 = all (default: 8000)
  --drafts, --locales, --default-locale   as for manifest
  --math, --mermaid     Parse the same extensions the site renders with

build options:
  --out <dir>           Output directory (default: ./dist-site)
  --base <path>         Deployment base path, e.g. /docs/ (default: /)
  --site-url <url>      Public URL incl. base — enables canonical/OG URLs, sitemap.xml, feeds
  --title <text>        Site title
  --description <text>  Site description
  --lang <code>         UI language for a single-locale site (en, ja)
  --locales, --default-locale, --drafts   as for manifest
  --blog                Blog list / tag / category routes (+ feeds with --site-url)
  --blog-dir <name>     Blog directory (default: blog)
  --blog-per-page <n>   Posts per page (default: 10)
  --search              Write search-index.json and enable the search box
  --math                TeX math ($x$, $$x$$); pre-rendered when katex is installed
  --mermaid             Mermaid diagrams (drawn in the browser)
  --theme <mode>        Default theme: light | dark | system
  --head <file>         HTML file injected into every page's <head>
  --author <name>       Default feed author
  --no-runtime          Emit plain static HTML + CSS only (no JS, manifest or search)
  --dist <dir>          Directory holding style.css / md-book.global.js (default: md-book's dist/)

feed options:
  --site-url <url>     Absolute site URL (required), e.g. https://example.com/
  --out <dir>          Directory to write feeds into (default: <contentDir>)
  --title <text>       Feed title (default: the site URL host)
  --description <text> Feed description
  --dir <name>         Blog directory (default: blog)
  --formats <list>     Comma list of rss,atom,json (default: all)
  --author <name>      Default author
  --language <code>    e.g. en, ja

dev options:
  --root <dir>          Static root served to the browser (default: .)
  --content <dir>       Markdown source directory (default: ./content)
  --base <path>         Site base path (default: /)
  --port <n>            Port (default: 4173)
  --host <name>         Host (default: localhost)
  --locales, --default-locale   as for manifest (also serves /search-index.json)

  -h, --help            Show this help
  -v, --version         Show version
`;

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  const command = argv[0];

  if (!command || command === '-h' || command === '--help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === '-v' || command === '--version') {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  try {
    if (command === 'manifest') return await runManifest(argv.slice(1));
    if (command === 'search-index') return runSearchIndex(argv.slice(1));
    if (command === 'build') return await runBuild(argv.slice(1));
    if (command === 'feed') return runFeed(argv.slice(1));
    if (command === 'dev') return await runDev(argv.slice(1));
  } catch (err) {
    process.stderr.write(`md-book: ${(err as Error).message}\n`);
    return 1;
  }

  process.stderr.write(`md-book: unknown command "${command}"\n\n${HELP}`);
  return 1;
}

async function runManifest(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      base: { type: 'string' },
      'content-base': { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      drafts: { type: 'boolean', default: false },
      locales: { type: 'string' },
      'default-locale': { type: 'string' },
    },
  });

  const contentDir = positionals[0];
  if (!contentDir) {
    process.stderr.write('md-book manifest: missing <contentDir>\n');
    return 1;
  }

  const out = values.out ?? `${contentDir.replace(/\/+$/, '')}/manifest.json`;
  const { manifest, written } = writeManifest({
    contentDir,
    out,
    base: values.base,
    contentBase: values['content-base'],
    title: values.title,
    description: values.description,
    includeDrafts: values.drafts,
    locales: parseLocales(values.locales),
    defaultLocale: values['default-locale'],
  });
  process.stdout.write(`md-book: wrote ${written} (${manifest.entries.length} pages)\n`);
  return 0;
}

function runSearchIndex(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      'max-chars': { type: 'string' },
      drafts: { type: 'boolean', default: false },
      locales: { type: 'string' },
      'default-locale': { type: 'string' },
      math: { type: 'boolean', default: false },
      mermaid: { type: 'boolean', default: false },
    },
  });
  const contentDir = positionals[0];
  if (!contentDir) {
    process.stderr.write('md-book search-index: missing <contentDir>\n');
    return 1;
  }
  const out = values.out ?? `${contentDir.replace(/\/+$/, '')}/search-index.json`;
  const { index, written } = writeSearchIndex({
    contentDir,
    out,
    maxChars: values['max-chars'] ? Number.parseInt(values['max-chars'], 10) : undefined,
    includeDrafts: values.drafts,
    locales: parseLocales(values.locales),
    defaultLocale: values['default-locale'],
    render: { math: values.math, mermaid: values.mermaid },
  });
  process.stdout.write(`md-book: wrote ${written} (${index.docs.length} pages)\n`);
  return 0;
}

async function runBuild(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      base: { type: 'string' },
      'site-url': { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      lang: { type: 'string' },
      locales: { type: 'string' },
      'default-locale': { type: 'string' },
      drafts: { type: 'boolean', default: false },
      blog: { type: 'boolean', default: false },
      'blog-dir': { type: 'string' },
      'blog-per-page': { type: 'string' },
      search: { type: 'boolean', default: false },
      math: { type: 'boolean', default: false },
      mermaid: { type: 'boolean', default: false },
      theme: { type: 'string' },
      head: { type: 'string' },
      author: { type: 'string' },
      'no-runtime': { type: 'boolean', default: false },
      dist: { type: 'string' },
    },
  });
  const contentDir = positionals[0];
  if (!contentDir) {
    process.stderr.write('md-book build: missing <contentDir>\n');
    return 1;
  }
  const perPage = values['blog-per-page']
    ? Number.parseInt(values['blog-per-page'], 10)
    : undefined;
  const blogOverrides = {
    ...(values['blog-dir'] ? { dir: values['blog-dir'] } : {}),
    ...(perPage && perPage > 0 ? { perPage } : {}),
  };
  const outDir = values.out ?? 'dist-site';
  const { pages, files } = await buildSite({
    contentDir,
    outDir,
    base: values.base,
    siteUrl: values['site-url'],
    title: values.title,
    description: values.description,
    locale: values.lang,
    locales: parseLocales(values.locales),
    defaultLocale: values['default-locale'],
    drafts: values.drafts,
    blog: values.blog || Object.keys(blogOverrides).length > 0 ? { ...blogOverrides } : false,
    search: values.search,
    math: values.math,
    mermaid: values.mermaid,
    theme: values.theme,
    headHTML: values.head ? readFileSync(values.head, 'utf8') : undefined,
    author: values.author,
    runtime: !values['no-runtime'],
    distDir: values.dist,
  });
  process.stdout.write(`md-book: built ${pages} pages (${files.length} files) into ${outDir}\n`);
  return 0;
}

/** `en,ja` or `en:English,ja:日本語` → locale configs. */
function parseLocales(value: string | undefined): LocaleConfig[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf(':');
      return at === -1
        ? { code: part }
        : { code: part.slice(0, at).trim(), label: part.slice(at + 1).trim() };
    });
}

function runFeed(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      'site-url': { type: 'string' },
      out: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      dir: { type: 'string' },
      formats: { type: 'string' },
      author: { type: 'string' },
      language: { type: 'string' },
    },
  });

  const contentDir = positionals[0];
  if (!contentDir) {
    process.stderr.write('md-book feed: missing <contentDir>\n');
    return 1;
  }
  const siteUrl = values['site-url'];
  if (!siteUrl) {
    process.stderr.write('md-book feed: --site-url is required\n');
    return 1;
  }

  const formats = values.formats
    ?.split(',')
    .map((f) => f.trim())
    .filter((f): f is 'rss' | 'atom' | 'json' => f === 'rss' || f === 'atom' || f === 'json');

  const { written, postCount } = writeFeeds({
    contentDir,
    siteUrl,
    outDir: values.out ?? contentDir,
    title: values.title ?? new URL(siteUrl).host,
    description: values.description,
    dir: values.dir,
    author: values.author,
    language: values.language,
    formats: formats && formats.length > 0 ? formats : undefined,
  });
  process.stdout.write(`md-book: wrote ${written.join(', ')} (${postCount} posts)\n`);
  return 0;
}

async function runDev(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      root: { type: 'string', default: '.' },
      content: { type: 'string', default: './content' },
      base: { type: 'string', default: '/' },
      port: { type: 'string' },
      host: { type: 'string' },
      locales: { type: 'string' },
      'default-locale': { type: 'string' },
    },
  });

  const server = await startDevServer({
    locales: parseLocales(values.locales),
    defaultLocale: values['default-locale'],
    root: values.root,
    contentDir: values.content,
    base: values.base,
    port: values.port ? Number.parseInt(values.port, 10) : undefined,
    host: values.host,
  });
  process.stdout.write(`md-book dev: serving ${values.root} at ${server.url}\n`);
  process.stdout.write('Press Ctrl+C to stop.\n');

  await new Promise<void>((resolvePromise) => {
    const stop = () => {
      void server.close().then(resolvePromise);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  return 0;
}

// Executed directly (not imported): run and set the exit code.
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`md-book: ${(err as Error).stack ?? err}\n`);
      process.exitCode = 1;
    },
  );
}
