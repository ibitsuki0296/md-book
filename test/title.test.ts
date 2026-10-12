// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { documentTitle } from '../src/core/head.js';
import { renderSite } from '../src/core/site.js';
import { MANIFEST_VERSION, type Manifest, makeEntry } from '../src/index.js';
import { mount } from '../src/runtime/index.js';

const FILES: Record<string, string> = {
  'index.md': '---\ntitle: My Site\nlayout: home\nhero:\n  name: Slogan\n---\n',
  'guide/start.md': '---\ntitle: Start\n---\n# Start\n',
};
const manifest: Manifest = {
  version: MANIFEST_VERSION,
  base: '/',
  contentBase: '/',
  title: 'My Site',
  generatedAt: '2026-01-01T00:00:00.000Z',
  entries: [
    makeEntry('index.md', { title: 'My Site', layout: 'home' }),
    makeEntry('guide/start.md', { title: 'Start' }),
  ],
};

describe('documentTitle', () => {
  it('appends the site name, but not when the page is named after the site', () => {
    expect(documentTitle('Start', 'My Site')).toBe('Start — My Site');
    expect(documentTitle('My Site', 'My Site')).toBe('My Site');
    expect(documentTitle(' My Site ', 'My Site')).toBe('My Site');
    expect(documentTitle('Start', '')).toBe('Start');
  });
});

describe('page titles', () => {
  const titleOf = (html: string) => /<title>(.*?)<\/title>/.exec(html)?.[1];

  it('static build: the home page is just the site title', () => {
    const pages = renderSite({ manifest, readSource: (e) => FILES[e.file] ?? '' });
    const html = (route: string) => pages.find((p) => p.route === route)?.html ?? '';
    expect(titleOf(html('/'))).toBe('My Site');
    expect(html('/')).toContain('<meta property="og:title" content="My Site">');
    expect(titleOf(html('/guide/start'))).toBe('Start — My Site');
  });

  it('runtime: same rule on navigation', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.history.replaceState({}, '', '/');
    const fetchText = async (url: string) => FILES[new URL(url).pathname.replace(/^\//, '')] ?? '';
    const handle = await mount('#app', { manifest, fetchText });
    expect(document.title).toBe('My Site');
    handle.navigate('/guide/start');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.title).toBe('Start — My Site');
    handle.destroy();
  });
});
