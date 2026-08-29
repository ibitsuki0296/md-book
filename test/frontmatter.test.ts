import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from '../src/core/frontmatter.js';

describe('parseFrontMatter', () => {
  it('returns the whole source when there is no front matter', () => {
    const r = parseFrontMatter('# Hello\n\nbody');
    expect(r).toEqual({ data: {}, content: '# Hello\n\nbody', hasFrontMatter: false });
  });

  it('extracts a YAML block and strips it from the body', () => {
    const r = parseFrontMatter('---\ntitle: Intro\ntags:\n  - a\n  - b\n---\n# Body\n');
    expect(r.hasFrontMatter).toBe(true);
    expect(r.data).toEqual({ title: 'Intro', tags: ['a', 'b'] });
    expect(r.content).toBe('# Body\n');
  });

  it('handles an empty front matter block', () => {
    const r = parseFrontMatter('---\n---\nbody');
    expect(r).toEqual({ data: {}, content: 'body', hasFrontMatter: true });
  });

  it('tolerates CRLF line endings and a leading BOM', () => {
    const r = parseFrontMatter('﻿---\r\ntitle: Win\r\n---\r\nbody');
    expect(r.data).toEqual({ title: 'Win' });
    expect(r.content).toBe('body');
  });

  it('ignores a --- that is not at the very start', () => {
    const r = parseFrontMatter('intro\n---\ntitle: nope\n---\n');
    expect(r.hasFrontMatter).toBe(false);
    expect(r.data).toEqual({});
  });

  it('coerces a non-object YAML document to an empty object', () => {
    expect(parseFrontMatter('---\n- just\n- a\n- list\n---\nbody').data).toEqual({});
  });

  it('parses ISO dates to Date values', () => {
    const r = parseFrontMatter('---\ndate: 2026-02-01\n---\n');
    expect(r.data.date).toBeInstanceOf(Date);
  });
});
