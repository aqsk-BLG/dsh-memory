import { defineConfig } from 'tsdown'

/** Self-contained bundle build: transpiles src/ to lib/ without project references or type checking. */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: true,
})
