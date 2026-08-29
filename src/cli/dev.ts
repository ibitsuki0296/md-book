import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { type GenerateManifestOptions, generateManifest } from './manifest.js';

export interface DevServerOptions {
  /** Static root served to the browser (contains index.html). */
  root: string;
  /** Markdown source directory scanned for `/manifest.json`. */
  contentDir: string;
  base?: string;
  port?: number;
  host?: string;
}

export interface DevServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

const LIVERELOAD_PATH = '/__mdbook_livereload';
const RELOAD_SNIPPET = `<script>(()=>{try{new EventSource(${JSON.stringify(
  LIVERELOAD_PATH,
)}).onmessage=e=>{if(e.data==="reload")location.reload()}}catch{}})()</script>`;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Starts a zero-config dev server with live reload and an on-the-fly `/manifest.json`. */
export function startDevServer(options: DevServerOptions): Promise<DevServer> {
  const root = resolve(options.root);
  const manifestOpts: GenerateManifestOptions = {
    contentDir: resolve(options.contentDir),
    base: options.base ?? '/',
    includeDrafts: true,
  };
  const clients = new Set<ServerResponse>();
  let manifestCache: string | null = null;

  const invalidate = () => {
    manifestCache = null;
    for (const res of clients) res.write('data: reload\n\n');
  };

  const server = createServer((req, res) => {
    handle(req, res, root, manifestOpts, clients, () => {
      if (manifestCache === null) {
        manifestCache = `${JSON.stringify(generateManifest(manifestOpts), null, 2)}\n`;
      }
      return manifestCache;
    }).catch((err) => {
      res.statusCode = 500;
      res.end(`md-book dev: ${(err as Error).message}`);
    });
  });

  const watchers = [
    safeWatch(root, invalidate),
    safeWatch(manifestOpts.contentDir, invalidate),
  ].filter((w): w is ReturnType<typeof watch> => w !== null);

  const requestedPort = options.port ?? 4173;
  const host = options.host ?? 'localhost';

  return new Promise((resolvePromise) => {
    server.listen(requestedPort, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : requestedPort;
      resolvePromise({
        url: `http://${host}:${port}/`,
        port,
        close: () =>
          new Promise((done) => {
            for (const w of watchers) w.close();
            for (const res of clients) res.end();
            server.close(() => done());
          }),
      });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  manifestOpts: GenerateManifestOptions,
  clients: Set<ServerResponse>,
  manifest: () => string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === LIVERELOAD_PATH) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const manifestRoute = joinBase(manifestOpts.base ?? '/', 'manifest.json');
  if (pathname === manifestRoute || pathname === '/manifest.json') {
    res.writeHead(200, { 'content-type': MIME['.json']!, 'cache-control': 'no-store' });
    res.end(manifest());
    return;
  }

  const filePath = resolveStaticPath(root, pathname);
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }

  // SPA fallback: serve index.html with the live-reload snippet injected.
  const indexPath = join(root, 'index.html');
  if (existsSync(indexPath)) {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(indexPath, 'utf8');
    res.writeHead(200, { 'content-type': MIME['.html']!, 'cache-control': 'no-store' });
    res.end(injectSnippet(html));
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
}

function resolveStaticPath(root: string, pathname: string): string | null {
  const rel = normalize(pathname)
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '');
  const abs = join(root, rel);
  return abs.startsWith(root) ? abs : null;
}

function sendFile(res: ServerResponse, filePath: string): void {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}

function injectSnippet(html: string): string {
  return html.includes('</body>')
    ? html.replace('</body>', `${RELOAD_SNIPPET}</body>`)
    : html + RELOAD_SNIPPET;
}

function joinBase(base: string, file: string): string {
  const prefix = base === '/' || base === '' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  return `${prefix}/${file}`;
}

function safeWatch(dir: string, onChange: () => void): ReturnType<typeof watch> | null {
  let timer: NodeJS.Timeout | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 60);
  };
  try {
    return watch(dir, { recursive: true }, debounced);
  } catch {
    try {
      return watch(dir, debounced);
    } catch {
      return null;
    }
  }
}
