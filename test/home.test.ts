import { describe, expect, it } from 'vitest';
import { renderHome } from '../src/core/home.js';

const href = (link: string) => `/base${link}`;

describe('renderHome', () => {
  it('renders nothing without hero or features', () => {
    expect(renderHome({})).toBe('');
    expect(renderHome({ hero: {} })).toBe('');
  });

  it('renders hero name, text, tagline and actions', () => {
    const html = renderHome(
      {
        hero: {
          name: 'md-book',
          text: 'Docs',
          tagline: 'Use `md` files',
          actions: [
            { text: 'Start', link: '/guide' },
            { text: 'Repo', link: 'https://example.com/x', theme: 'alt' },
          ],
        },
      },
      href,
    );
    expect(html).toContain('<h1 class="md-book-hero__name">md-book</h1>');
    expect(html).toContain('<p class="md-book-hero__text">Docs</p>');
    expect(html).toContain('Use <code>md</code> files');
    expect(html).toContain('md-book-hero__action--brand" href="/base/guide"');
    expect(html).toContain(
      'md-book-hero__action--alt" href="https://example.com/x" rel="noopener noreferrer"',
    );
  });

  it('makes only the first action brand by default', () => {
    const html = renderHome({
      hero: {
        actions: [
          { text: 'A', link: '/a' },
          { text: 'B', link: '/b' },
        ],
      },
    });
    expect(html.match(/--brand/g)).toHaveLength(1);
    expect(html.match(/--alt/g)).toHaveLength(1);
  });

  it('renders feature cards, linking the whole card when a link is given', () => {
    const html = renderHome(
      {
        features: [
          { title: 'One', details: 'first', icon: '★' },
          { title: 'Two', link: '/two' },
        ],
      },
      href,
    );
    expect(html).toContain('<div class="md-book-feature"><span');
    expect(html).toContain('<a class="md-book-feature md-book-feature--link" href="/base/two">');
    expect(html).toContain('<p class="md-book-feature__details">first</p>');
  });

  it('escapes text and drops unsafe link schemes', () => {
    const html = renderHome({
      hero: {
        text: '<script>x</script>',
        actions: [
          { text: 'Bad', link: 'javascript:alert(1)' },
          { text: 'Data', link: 'data:text/html,hi' },
          { text: 'Q"uote', link: '/a"b' },
        ],
      },
      features: [{ title: '<b>t</b>', details: '"<i>"' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('href="/a&quot;b"');
    expect(html).toContain('&lt;b&gt;t&lt;/b&gt;');
  });

  it('ignores malformed input', () => {
    expect(() =>
      renderHome({
        hero: 'nope' as never,
        features: [null, 3, { title: '' }, { title: 'ok' }] as never,
      }),
    ).not.toThrow();
  });
});
