import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

/**
 * `npm run build` = `vite build && node scripts/build-api.mjs`. Aquí:
 * 1) `gen-shell.mjs` congela `client/dist/index.html` en pageShell.ts (para el
 *    render en servidor de <title>/meta/JSON-LD por ruta).
 * 2) esbuild empaqueta el servidor Express en `api/_server.mjs` (Vercel solo
 *    rastrea lo que hay dentro de `api/`). Las deps de node_modules quedan externas.
 */
execFileSync(process.execPath, ['scripts/gen-shell.mjs'], { stdio: 'inherit' });

await build({
  entryPoints: ['server/app.ts'],
  outfile: 'api/_server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
  banner: {
    // shim para libs CJS que esperan `require` en un contexto ESM empaquetado
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});

console.log('[build-api] api/_server.mjs generado');
