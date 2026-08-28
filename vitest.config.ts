import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
    env: {
      // Postgres inexistente: el Pool se crea pero las consultas fallan rápido.
      // Los tests toleran el fallo de BD (200 o 500) y verifican health/no-store/401/404.
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:59599/test',
    },
  },
});
