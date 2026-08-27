import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: 'client',
  resolve: {
    alias: {
      '@': `${root}client/src`,
      '@shared': `${root}shared`,
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
