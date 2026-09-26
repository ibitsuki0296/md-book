import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startDevServer } from '../src/cli/dev.js';

let dir: string;
let stop: (() => Promise<void>) | null = null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'md-book-dev-'));
  mkdirSync(join(dir, 'content', 'guide'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><body><h1>app</h1></body>');
  writeFileSync(join(dir, 'app.css'), 'body{color:red}');
  writeFileSync(join(dir, 'content', 'index.md'), '# Home');
  writeFileSync(join(dir, 'content', 'guide', 'intro.md'), '---\ntitle: Intro\n---\nhi');
});

afterEach(async () => {
  if (stop) await stop();
  stop = null;
  rmSync(dir, { recursive: true, force: true });
});

describe('startDevServer', () => {
  it('serves a generated manifest, static files, and an SPA fallback with live reload', async () => {
    const server = await startDevServer({
      root: dir,
      contentDir: join(dir, 'content'),
      port: 0,
    });
    stop = server.close;
    const origin = server.url.replace(/\/$/, '');

    const manifest = await (await fetch(`${origin}/manifest.json`)).json();
    expect(manifest.entries.map((e: { path: string }) => e.path)).toEqual(['/', '/guide/intro']);
    expect(manifest.contentBase).toBe('/@content');

    const css = await fetch(`${origin}/app.css`);
    expect(css.headers.get('content-type')).toContain('text/css');
    expect(await css.text()).toContain('color:red');

    const raw = await fetch(`${origin}/@content/guide/intro.md`);
    expect(raw.headers.get('content-type')).toContain('text/markdown');
    expect(await raw.text()).toContain('title: Intro');

    const missing = await fetch(`${origin}/@content/guide/nope.md`);
    expect(missing.status).toBe(404);

    const spa = await fetch(`${origin}/guide/intro`);
    const html = await spa.text();
    expect(spa.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<h1>app</h1>');
    expect(html).toContain('__mdbook_livereload');
  });

  it('serves a live search index and locale-aware manifest', async () => {
    mkdirSync(join(dir, 'content', 'ja'), { recursive: true });
    writeFileSync(join(dir, 'content', 'ja', 'index.md'), '---\ntitle: ホーム\n---\n日本語');
    const server = await startDevServer({
      root: dir,
      contentDir: join(dir, 'content'),
      port: 0,
      locales: ['en', 'ja'],
    });
    stop = server.close;
    const origin = server.url.replace(/\/$/, '');

    const index = await (await fetch(`${origin}/search-index.json`)).json();
    expect(index.docs.map((d: { path: string; locale: string }) => [d.path, d.locale])).toEqual([
      ['/', 'en'],
      ['/guide/intro', 'en'],
      ['/ja', 'ja'],
    ]);
    const manifest = await (await fetch(`${origin}/manifest.json`)).json();
    expect(manifest.defaultLocale).toBe('en');

    // Edits show up without restarting (the cache is invalidated by the watcher).
    writeFileSync(join(dir, 'content', 'guide', 'intro.md'), '---\ntitle: Renamed\n---\nhi');
    await vi.waitFor(
      async () => {
        const after = await (await fetch(`${origin}/search-index.json`)).json();
        expect(after.docs.find((d: { path: string }) => d.path === '/guide/intro').title).toBe(
          'Renamed',
        );
      },
      { timeout: 3000, interval: 100 },
    );
  });
});
