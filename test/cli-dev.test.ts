import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    const css = await fetch(`${origin}/app.css`);
    expect(css.headers.get('content-type')).toContain('text/css');
    expect(await css.text()).toContain('color:red');

    const spa = await fetch(`${origin}/guide/intro`);
    const html = await spa.text();
    expect(spa.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<h1>app</h1>');
    expect(html).toContain('__mdbook_livereload');
  });
});
