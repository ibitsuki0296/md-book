import { defineConfig } from 'tsup';

// Entry points grow as milestones land (runtime UI, CDN global build).
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
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
]);
