import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/server/index.ts', 'create-host': 'scripts/create-host.ts' },
  format: ['esm'], platform: 'node', target: 'node22', outDir: 'dist/server', clean: true,
  external: ['vite'],
  // node:sqlite has no bare "sqlite" equivalent.
  removeNodeProtocol: false,
});
