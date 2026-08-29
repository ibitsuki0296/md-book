import { defineConfig } from 'tsup';

export default defineConfig([
  // Library entries: core + runtime (ESM + CJS + d.ts).
  {
    entry: { index: 'src/index.ts', runtime: 'src/runtime/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    platform: 'neutral',
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.mjs' };
    },
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
