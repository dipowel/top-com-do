import 'dotenv/config';
import { isLocalDb } from './db';
import { ensureLocalDb } from './lib/localSetup';
import { seedAll } from './seed-core';

/**
 * CLI de seed.  `npm run seed`       →  solo base (categorías, cuentas, ronda).
 *                `npm run seed:demo`  →  base + perfiles de demostración con pujas.
 */
async function main() {
  const demo = process.argv.includes('--demo');

  if (isLocalDb) {
    await ensureLocalDb();
    console.log('[seed] Base de datos local (PGlite) lista.');
  }

  await seedAll({ demo });

  console.log('[seed] Completo.' + (demo ? ' (con datos de demostración)' : ' (solo base)'));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
