import { defineConfig } from 'tsup';

const ext = (format: string) => ({ js: format === 'cjs' ? '.cjs' : '.mjs' });

// github-slugger v2 is ESM-only; a CJS bundle that `require()`s it gets the wrong
// default export, so the CJS outputs bundle it instead of leaving it external.
const cjsNoExternal = ['github-slugger'];

export default defineConfig([
  // Library entries: core + runtime (ESM + d.ts, then CJS).
  {
    entry: { index: 'src/index.ts', runtime: 'src/runtime/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    platform: 'neutral',
    outExtension: ({ format }) => ext(format),
  },
  {
    entry: { index: 'src/index.ts', runtime: 'src/runtime/index.ts' },
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    platform: 'neutral',
    noExternal: cjsNoExternal,
    outExtension: ({ format }) => ext(format),
  },
  // Node API + framework adapters (Vite / Astro / Next): Node-only, ESM + CJS.
  {
    entry: {
      node: 'src/node.ts',
      vite: 'src/adapters/vite.ts',
      astro: 'src/adapters/astro.ts',
      next: 'src/adapters/next.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    platform: 'node',
    outExtension: ({ format }) => ext(format),
  },
  {
    entry: {
      node: 'src/node.ts',
      vite: 'src/adapters/vite.ts',
      astro: 'src/adapters/astro.ts',
      next: 'src/adapters/next.ts',
    },
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    platform: 'node',
    noExternal: cjsNoExternal,
    // `import.meta.url` (locating dist/ assets) needs a CJS shim.
    shims: true,
    outExtension: ({ format }) => ext(format),
  },
  // CLI: Node-only, single ESM file with a shebang.
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2022',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    outExtension() {
      return { js: '.mjs' };
    },
  },
  // CDN: one minified IIFE, everything bundled, exposes `window.MdBook`.
  {
    entry: { 'md-book.global': 'src/runtime/global.ts' },
    format: ['iife'],
    globalName: 'MdBook',
    minify: true,
    sourcemap: true,
    target: 'es2020',
    platform: 'browser',
    noExternal: [/.*/],
    outExtension() {
      return { js: '.js' };
    },
  },
]);
