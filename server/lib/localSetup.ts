import { isLocalDb, pglite } from '../db';

let migrated = false;

/**
 * Aplica las migraciones de ./drizzle sobre la base PGlite local.
 * Idempotente: drizzle registra las migraciones aplicadas.
 * En modo producción (Neon) no hace nada — ahí se usa `npm run db:push`.
 */
export async function ensureLocalDb(): Promise<void> {
  if (!isLocalDb || !pglite || migrated) return;
  migrated = true;
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const d = drizzle(pglite);
  await migrate(d, { migrationsFolder: './drizzle' });
  console.log('[db] Migraciones locales aplicadas');
}
