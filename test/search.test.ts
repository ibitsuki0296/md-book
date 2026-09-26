import { describe, expect, it } from 'vitest';
import {
  type SearchDoc,
  assertSearchIndex,
  createSearchIndex,
  createSearcher,
  extractSearchDoc,
  htmlToText,
} from '../src/index.js';

const doc = (over: Partial<SearchDoc> & { path: string; title: string }): SearchDoc => ({
  headings: [],
  text: '',
  ...over,
});

describe('extractSearchDoc', () => {
  const source = [
    '---',
    'title: Theming',
    'description: Make it yours',
    '---',
    '# Theming',
    '',
    'Override **tokens** with [CSS](./css.md).',
    '',
    '## Dark mode',
    '',
    '```css',
    ':root { --x: 1; }',
    '```',
    '',
    'A ruby {漢字|かんじ} here & <b>escaped</b>.',
  ].join('\n');

  it('extracts title, headings and visible body text', () => {
    const d = extractSearchDoc(source, { path: '/guide/theming', title: 'fallback' });
    expect(d.title).toBe('Theming');
    expect(d.headings).toEqual(['Theming', 'Dark mode']);
    expect(d.text).toContain('Make it yours');
    expect(d.text).toContain('Override tokens with CSS.');
    expect(d.text).toContain('--x: 1'); // code is searchable
    expect(d.text).toContain('漢字'); // ruby base…
    expect(d.text).not.toContain('かんじ'); // …but not the reading
    expect(d.text).toContain('& <b>escaped</b>'); // raw HTML is text, entities decoded
    expect(d.text).not.toMatch(/<\/?(p|h2|strong)/);
  });

  it('falls back to the given title, records locale, and truncates', () => {
    const d = extractSearchDoc(
      'just text '.repeat(50),
      { path: '/x', title: 'Fallback', locale: 'ja' },
      { maxChars: 40 },
    );
    expect(d.title).toBe('Fallback');
    expect(d.locale).toBe('ja');
    expect(d.text).toHaveLength(40);
  });

  it('indexes home-layout hero and feature text', () => {
    const d = extractSearchDoc(
      '---\nlayout: home\nhero:\n  text: Big idea\nfeatures:\n  - title: Fast\n    details: Really quick\n---\n',
      { path: '/', title: 'Home' },
    );
    expect(d.text).toContain('Big idea');
    expect(d.text).toContain('Fast');
    expect(d.text).toContain('Really quick');
  });
});

describe('htmlToText', () => {
  it('strips tags, scripts and decodes entities', () => {
    expect(htmlToText('<p>a &amp; b &lt;c&gt; &#x41;&#66;</p><script>x()</script>')).toContain(
      'a & b <c> AB',
    );
    expect(htmlToText('<script>x()</script>y')).not.toContain('x()');
  });
});

describe('createSearcher', () => {
  const index = createSearchIndex([
    doc({
      path: '/a',
      title: 'Getting started',
      headings: ['Install'],
      text: 'Run the installer and configure it.',
    }),
    doc({
      path: '/b',
      title: 'Configuration',
      text: 'Options for install and theming. Install twice.',
    }),
    doc({
      path: '/c',
      title: '縦書きの使い方',
      headings: ['ルビ'],
      text: '漢字にふりがなを付けます。縦書きは短歌に向いています。',
      locale: 'ja',
    }),
    doc({ path: '/d', title: 'English only', text: 'nothing relevant', locale: 'en' }),
  ]);
  const searcher = createSearcher(index);

  it('matches case-insensitively and ranks title > heading > body', () => {
    const results = searcher.search('INSTALL');
    expect(results.map((r) => r.path)).toEqual(['/a', '/b']);
    expect(results[0]?.heading).toBe('Install');
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it('requires every term (AND) in any field', () => {
    expect(searcher.search('install theming').map((r) => r.path)).toEqual(['/b']);
    expect(searcher.search('install nonexistent')).toEqual([]);
    expect(searcher.search('   ')).toEqual([]);
  });

  it('works for Japanese without word boundaries and unifies width', () => {
    expect(searcher.search('ふりがな').map((r) => r.path)).toEqual(['/c']);
    expect(searcher.search('短歌')[0]?.path).toBe('/c');
    expect(searcher.search('ｲﾝｽﾄｰﾙ')).toEqual([]); // half-width katakana ≠ latin
    expect(searcher.search('ＩＮＳＴＡＬＬ').map((r) => r.path)).toEqual(['/a', '/b']); // full-width latin folds
  });

  it('returns a snippet with highlight ranges into it', () => {
    const [hit] = searcher.search('theming');
    const marked = hit!.ranges.map(([s, e]) => hit!.snippet.slice(s, e).toLowerCase());
    expect(marked).toContain('theming');
  });

  it('honours limit and locale', () => {
    expect(searcher.search('install', { limit: 1 })).toHaveLength(1);
    expect(searcher.search('only', { locale: 'ja' })).toEqual([]);
    expect(searcher.search('only', { locale: 'en' }).map((r) => r.path)).toEqual(['/d']);
    // docs without a locale are never filtered out
    expect(searcher.search('install', { locale: 'ja' }).map((r) => r.path)).toEqual(['/a', '/b']);
  });
});

describe('assertSearchIndex', () => {
  it('accepts a valid index and rejects garbage', () => {
    expect(() => assertSearchIndex(createSearchIndex([]))).not.toThrow();
    expect(() => assertSearchIndex({ version: 99, docs: [] })).toThrow();
    expect(() => assertSearchIndex(null)).toThrow();
  });
});
