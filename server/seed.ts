import 'dotenv/config';
import { seedAll } from './seed-core';

/**
 * `npm run seed`       →  solo base (categorías, cuentas, ronda).
 * `npm run seed:demo`  →  base + perfiles de demostración con pujas.
 */
async function main() {
  const demo = process.argv.includes('--demo');
  await seedAll({ demo });
  console.log('[seed] Completo.' + (demo ? ' (con datos de demostración)' : ' (solo base)'));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
