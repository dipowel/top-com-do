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
    rollupOptions: {
      output: {
        // Solo se separan las librerías grandes y estables que SÍ están en el
        // camino crítico (mejor caché entre despliegues). El resto lo decide
        // Rollup, para que lo que solo usan rutas lazy no entre en el bundle inicial.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router') || id.includes('/history/')) return 'vendor-router';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
        },
      },
    },
  },
});
