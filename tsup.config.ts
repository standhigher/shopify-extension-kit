import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/core/index.ts'],
  outDir: 'dist/core',
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
