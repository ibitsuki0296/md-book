// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { getStrings } from '../src/core/i18n.js';
import { renderShell } from '../src/core/shell.js';
import { buildNav, buildSidebar, flattenPages, getPrevNext, makeEntry } from '../src/index.js';
import { createApp } from '../src/runtime/app.js';
import { createRouter } from '../src/runtime/router.js';

/** Order-insensitive, whitespace-insensitive structural dump of a DOM tree. */
function canon(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? '').trim();
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const attrs = [...el.attributes]
    .map((a) => `${a.name}=${a.name === 'class' ? a.value.split(/\s+/).sort().join(' ') : a.value}`)
    .sort()
    .join(' ');
  const kids = [...el.childNodes].map(canon).filter(Boolean).join('|');
  return `<${el.tagName.toLowerCase()} ${attrs}>${kids}</>`;
}

const entries = [
  makeEntry('index.md', { title: 'Home' }),
  makeEntry('guide/01-start.md', { title: 'Start' }),
  makeEntry('guide/02-theming.md', { title: 'Theming' }),
  makeEntry('blog/2026-02-01-hello.md', { title: 'Hello', date: '2026-02-01' }),
];
const t = getStrings('en');

beforeEach(() => {
  window.history.replaceState({}, '', '/guide/start');
  document.body.innerHTML = '';
});

describe('renderShell parity with the runtime app shell', () => {
  for (const variant of [
    { name: 'a docs page', layout: undefined, writing: undefined },
    { name: 'a home page', layout: 'home', writing: undefined },
    { name: 'a vertical page', layout: undefined, writing: 'vertical' },
  ]) {
    it(`matches for ${variant.name}`, () => {
      const path = '/guide/start';
      const sidebar = buildSidebar(entries, { section: '/guide' });
      const ordered = flattenPages(buildSidebar(entries));
      const prevNext = getPrevNext(ordered, path);
      const toc = [
        {
          level: 2,
          id: 'install',
          text: 'Install',
          children: [{ level: 3, id: 'npm', text: 'npm', children: [] }],
        },
      ];
      const nav = buildNav(entries);
      const contentHTML = '<h1>Start</h1><p>Body &amp; more</p>';

      const host = document.createElement('div');
      document.body.append(host);
      const router = createRouter({ base: '/', onNavigate: () => undefined });
      router.start();
      const app = createApp(host, { site: { title: 'Site' }, router, strings: t });
      app.renderNav(nav);
      app.renderPage({
        path,
        title: 'Start',
        contentHTML,
        sidebar,
        toc,
        prevNext,
        layout: variant.layout,
        writing: variant.writing,
      });

      const staticHTML = renderShell({
        site: { title: 'Site' },
        strings: t,
        href: (r) => router.href(r),
        nav,
        path,
        page: {
          contentHTML,
          sidebar,
          toc,
          prevNext,
          layout: variant.layout,
          writing: variant.writing,
        },
      });
      const holder = document.createElement('div');
      holder.innerHTML = staticHTML;

      expect(canon(host.firstElementChild!).length).toBeGreaterThan(400);
      expect(canon(holder.firstElementChild!)).toBe(canon(host.firstElementChild!));
      router.stop();
    });
  }
});
