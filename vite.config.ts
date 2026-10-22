import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./src/client/index.html', import.meta.url)),
        selector: fileURLToPath(new URL('./src/client/selector.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:2567',
      '/matchmake': 'http://127.0.0.1:2567',
      '/socket': { target: 'http://127.0.0.1:2567', ws: true, rewrite: (path) => path.replace(/^\/socket/, '') },
    },
  },
});
