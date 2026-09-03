import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

/**
 * 1) Congela el HTML base (`client/dist/index.html`, ya con los assets con hash)
 *    en `server/generated/pageShell.ts` para que el render en servidor pueda
 *    inyectar <title>/meta/canónico/JSON-LD por ruta. `npm run build` corre
 *    `vite build` ANTES que este script, así que el archivo ya existe.
 * 2) Empaqueta el servidor Express en `api/_server.mjs` (Vercel solo rastrea
 *    lo que hay dentro de `api/`). Las deps de node_modules quedan externas.
 */

const shell = existsSync('client/dist/index.html')
  ? readFileSync('client/dist/index.html', 'utf8')
  : '';
mkdirSync('server/generated', { recursive: true });
writeFileSync(
  'server/generated/pageShell.ts',
  `/* AUTO-GENERADO por scripts/build-api.mjs — no editar a mano. */\nexport const PAGE_SHELL: string = ${JSON.stringify(shell)};\n`,
);
console.log(`[build-api] pageShell.ts (${shell.length} bytes de HTML base)`);

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
