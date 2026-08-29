import { parseArgs } from 'node:util';
import { version } from '../version.js';
import { startDevServer } from './dev.js';
import { writeManifest } from './manifest.js';

const HELP = `md-book — Markdown documentation & blog toolkit

Usage:
  md-book manifest <contentDir> [options]   Scan Markdown files into manifest.json
  md-book dev [options]                     Serve a site with live reload

manifest options:
  --out <file>          Output path (default: <contentDir>/manifest.json)
  --base <path>         Site base path baked into routes (default: /)
  --content-base <url>  URL prefix the runtime uses to fetch raw .md
  --title <text>        Site title stored in the manifest
  --description <text>  Site description stored in the manifest
  --drafts             Include pages with front matter draft: true

dev options:
  --root <dir>          Static root served to the browser (default: .)
  --content <dir>       Markdown source directory (default: ./content)
  --base <path>         Site base path (default: /)
  --port <n>            Port (default: 4173)
  --host <name>         Host (default: localhost)

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
  });
  process.stdout.write(`md-book: wrote ${written} (${manifest.entries.length} pages)\n`);
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
    },
  });

  const server = await startDevServer({
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
