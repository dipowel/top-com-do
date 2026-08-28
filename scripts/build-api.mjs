import { build } from 'esbuild';

/**
 * Empaqueta el servidor Express en un único archivo dentro de `api/` para que
 * la función serverless de Vercel lo incluya sin depender del rastreo de
 * archivos fuera de `api/` (que fallaba con "Cannot find module '../server/app'").
 * Las dependencias de node_modules quedan externas: Vercel las copia por su cuenta.
 */
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
