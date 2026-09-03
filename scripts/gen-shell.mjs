import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

/**
 * Congela `client/dist/index.html` (ya con assets con hash) en
 * `server/generated/pageShell.ts` para que el render en servidor inyecte
 * <title>/meta/canónico/JSON-LD por ruta. Si aún no hay build, deja el shell
 * vacío (renderPage usa entonces un HTML mínimo de respaldo). Rápido, sin esbuild:
 * lo corre `prepare` (tras `npm install`) y `npm run build` (tras `vite build`).
 */
const shell = existsSync('client/dist/index.html')
  ? readFileSync('client/dist/index.html', 'utf8')
  : '';
mkdirSync('server/generated', { recursive: true });
writeFileSync(
  'server/generated/pageShell.ts',
  `/* AUTO-GENERADO por scripts/gen-shell.mjs — no editar a mano. */\nexport const PAGE_SHELL: string = ${JSON.stringify(shell)};\n`,
);
console.log(`[gen-shell] pageShell.ts (${shell.length} bytes de HTML base)`);
