import { load as parseYaml } from 'js-yaml';

export interface ParsedFrontMatter {
  /** Parsed YAML front matter, or an empty object when there is none. */
  data: Record<string, unknown>;
  /** The document body with the front matter block removed. */
  content: string;
  /** Whether a front matter block was present. */
  hasFrontMatter: boolean;
}

// Opening fence `---` on its own line at the very start of the file (BOM allowed),
// a YAML block, then a closing `---` line. The newline before the close is
// optional so an empty block (`---\n---`) still parses.
const FENCE = /^﻿?---[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?---[ \t]*(?:\r?\n|$)/;

/**
 * Splits a Markdown document into YAML front matter and body. Browser-safe
 * replacement for `gray-matter` — no Node `Buffer` dependency.
 */
export function parseFrontMatter(source: string): ParsedFrontMatter {
  const match = source.match(FENCE);
  if (!match) return { data: {}, content: source, hasFrontMatter: false };

  const body = source.slice(match[0].length);
  const yaml = match[1] ?? '';
  if (yaml.trim().length === 0) return { data: {}, content: body, hasFrontMatter: true };

  const parsed = parseYaml(yaml, { filename: 'frontmatter' });
  const data =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { data, content: body, hasFrontMatter: true };
}
