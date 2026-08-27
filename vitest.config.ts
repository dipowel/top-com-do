import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
    env: {
      // Base PGlite aislada para los tests (no toca la de desarrollo).
      DATABASE_URL: 'pglite://test',
      PGLITE_DIR: './.pglite-test',
    },
  },
});
