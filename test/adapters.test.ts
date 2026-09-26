import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mdBook as astroMdBook } from '../src/adapters/astro.js';
import { withMdBook } from '../src/adapters/next.js';
import { collectSiteAssets, normalizeBase, writeAssets } from '../src/adapters/shared.js';
import { VIRTUAL_MANIFEST_ID, mdBook as viteMdBook } from '../src/adapters/vite.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'md-book-adapters-'));
  mkdirSync(join(root, 'content', 'guide'), { recursive: true });
  writeFileSync(join(root, 'content', 'index.md'), '---\ntitle: Home\n---\n# Home\n');
  writeFileSync(join(root, 'content', 'guide', 'a.md'), '---\ntitle: A\n---\nalpha text\n');
  writeFileSync(join(root, 'content', 'wip.md'), '---\ndraft: true\n---\nwip\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as string | Uint8Array | undefined,
    setHeader(k: string, v: string) {
      res.headers[k.toLowerCase()] = v;
    },
    end(chunk?: string | Uint8Array) {
      res.body = chunk;
    },
  };
  return res;
}

function fakeServer() {
  const handlers: Array<
    (req: { url?: string }, res: ReturnType<typeof fakeRes>, next: () => void) => void
  > = [];
  const close: Array<() => void> = [];
  return {
    handlers,
    close,
    server: {
      middlewares: { use: (h: (typeof handlers)[number]) => handlers.push(h) },
      httpServer: { on: (_e: 'close', l: () => void) => close.push(l) },
      watcher: { add: vi.fn() },
      ws: { send: vi.fn() },
    },
    request(url: string) {
      const res = fakeRes();
      const next = vi.fn();
      for (const h of handlers) h({ url }, res, next);
      return { res, next };
    },
  };
}

describe('shared', () => {
  it('normalises bases', () => {
    expect(normalizeBase(undefined)).toBe('/');
    expect(normalizeBase('./')).toBe('/');
    expect(normalizeBase('/docs/')).toBe('/docs');
    expect(normalizeBase('docs')).toBe('/docs');
  });

  it('collects manifest, search index and raw markdown with base-relative routes', () => {
    const { manifest, files } = collectSiteAssets({}, root, '/docs', 'build');
    expect(manifest.base).toBe('/docs');
    expect(manifest.contentBase).toBe('/docs/md-book-content');
    expect(manifest.entries.map((e) => e.path)).toEqual(['/', '/guide/a']); // draft excluded
    expect([...files.keys()].sort()).toEqual([
      'manifest.json',
      'md-book-content/guide/a.md',
      'md-book-content/index.md',
      'search-index.json',
    ]);
    expect(JSON.parse(files.get('search-index.json') as string).docs).toHaveLength(2);
  });

  it('includes drafts in dev, honours search:false and drafts:true', () => {
    expect(collectSiteAssets({}, root, '/', 'dev').manifest.entries).toHaveLength(3);
    expect(collectSiteAssets({ drafts: true }, root, '/', 'build').manifest.entries).toHaveLength(
      3,
    );
    expect(
      collectSiteAssets({ search: false }, root, '/', 'build').files.has('search-index.json'),
    ).toBe(false);
  });

  it('writeAssets refuses paths that escape the output directory', () => {
    const out = join(root, 'out');
    writeAssets(out, new Map([['a/b.json', '{}']]));
    expect(readFileSync(join(out, 'a/b.json'), 'utf8')).toBe('{}');
    expect(() => writeAssets(out, new Map([['../evil.txt', 'x']]))).toThrow(/outside/);
    expect(existsSync(join(root, 'evil.txt'))).toBe(false);
  });
});

describe('vite plugin', () => {
  it('serves generated files in dev, with or without the base prefix', () => {
    const plugin = viteMdBook({ contentDir: 'content' });
    plugin.configResolved({ root, base: '/docs/' });
    const { server, request, close } = fakeServer();
    plugin.configureServer(server);
    expect(server.watcher.add).toHaveBeenCalled();
    expect(close).toHaveLength(1);

    const manifest = request('/docs/manifest.json');
    expect(manifest.res.statusCode).toBe(200);
    expect(manifest.res.headers['content-type']).toContain('application/json');
    expect(JSON.parse(manifest.res.body as string).entries).toHaveLength(3); // dev includes drafts

    const md = request('/docs/md-book-content/guide/a.md?t=1');
    expect(md.res.headers['content-type']).toContain('text/markdown');
    expect(md.res.body).toBeInstanceOf(Buffer);

    // Dev servers that strip the base before middleware (Astro) send the bare path.
    expect(request('/manifest.json').res.statusCode).toBe(200);
    expect(request('/docs/unknown.json').next).toHaveBeenCalled();
    expect(request('/other/page').next).toHaveBeenCalled();
    expect(request('/docs/%E0%A4%A').next).toHaveBeenCalled(); // malformed escape
    close[0]?.();
  });

  it('emits assets on build and exposes a virtual manifest module', () => {
    const plugin = viteMdBook({ contentDir: 'content', title: 'T' });
    plugin.configResolved({ root, base: '/' });
    const emitted: string[] = [];
    plugin.generateBundle.call({
      emitFile: (f) => {
        emitted.push(f.fileName);
        return f.fileName;
      },
    });
    expect(emitted).toContain('manifest.json');
    expect(emitted).toContain('md-book-content/guide/a.md');

    const id = plugin.resolveId(VIRTUAL_MANIFEST_ID);
    expect(id).toBe(`\0${VIRTUAL_MANIFEST_ID}`);
    expect(plugin.resolveId('other')).toBeUndefined();
    const code = plugin.load(id!)!;
    expect(code.startsWith('export default {')).toBe(true);
    expect(code).toContain('"title":"T"');
    expect(plugin.load('other')).toBeUndefined();
  });

  it('lets options.base override the Vite base', () => {
    const plugin = viteMdBook({ contentDir: 'content', base: '/x/' });
    plugin.configResolved({ root, base: '/' });
    const { server, request } = fakeServer();
    plugin.configureServer(server);
    expect(request('/x/manifest.json').res.statusCode).toBe(200);
  });
});

describe('astro integration', () => {
  it('reads root/base, serves in dev and writes into the build output', () => {
    const integration = astroMdBook({ contentDir: 'content' });
    integration.hooks['astro:config:setup']({
      config: { root: pathToFileURL(`${root}/`), base: '/docs' },
    });
    const { server, request } = fakeServer();
    integration.hooks['astro:server:setup']({ server });
    expect(request('/docs/manifest.json').res.statusCode).toBe(200);

    const dir = join(root, 'dist');
    integration.hooks['astro:build:done']({ dir: pathToFileURL(`${dir}/`) });
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.base).toBe('/docs');
    expect(manifest.entries).toHaveLength(2); // drafts excluded from the build
    expect(existsSync(join(dir, 'md-book-content/guide/a.md'))).toBe(true);
  });
});

describe('next adapter', () => {
  const cwd = process.cwd();
  afterEach(() => process.chdir(cwd));

  it('generates files into public/ and passes the config through', async () => {
    process.chdir(root);
    const config = { basePath: '/blog-site', reactStrictMode: true };
    const wrapped = withMdBook({ contentDir: 'content' })(config);
    const result = await wrapped('phase-production-build', { defaultConfig: {} });
    expect(result).toBe(config);
    const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8'));
    expect(manifest.base).toBe('/blog-site');
    expect(manifest.entries).toHaveLength(2);
  });

  it('accepts a config function and a custom publicDir', async () => {
    process.chdir(root);
    const wrapped = withMdBook({ contentDir: 'content', publicDir: 'static', search: false })(
      async (phase) => ({ env: { phase } }),
    );
    const result = await wrapped('phase-production-build', { defaultConfig: {} });
    expect(result).toEqual({ env: { phase: 'phase-production-build' } });
    expect(existsSync(join(root, 'static/manifest.json'))).toBe(true);
    expect(existsSync(join(root, 'static/search-index.json'))).toBe(false);
  });
});
