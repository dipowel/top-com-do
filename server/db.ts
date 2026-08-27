import 'dotenv/config';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '../shared/schema';

const require = createRequire(import.meta.url);
const rawUrl = process.env.DATABASE_URL || '';

/**
 * Modo local: sin DATABASE_URL (o DATABASE_URL=pglite://...) se usa PGlite,
 * un PostgreSQL embebido (WASM) que corre en el propio proceso y persiste en
 * disco. No requiere ningún servicio externo ni llaves.
 *
 * Modo remoto: con una DATABASE_URL real (Supabase, Neon, RDS, …) se usa
 * el driver estándar `pg` (node-postgres) con SSL.
 */
export const isLocalDb = !rawUrl || rawUrl.startsWith('pglite');

type DB = NodePgDatabase<typeof schema>;

let dbInstance: DB;
let pgliteClient: PGlite | null = null;

if (isLocalDb) {
  const { PGlite: PGliteCtor } = require('@electric-sql/pglite') as typeof import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = require('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite');
  const dir = process.env.PGLITE_DIR || './.pglite';
  pgliteClient = new PGliteCtor(dir);
  dbInstance = drizzlePglite(pgliteClient, { schema }) as unknown as DB;
  console.log(`[db] Modo local (PGlite) — datos en ${dir}`);
} else {
  const isLoopback = /@(localhost|127\.0\.0\.1)[:/]/.test(rawUrl);
  const pool = new Pool({
    connectionString: rawUrl,
    ssl: isLoopback ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX) || 5,
  });
  dbInstance = drizzleNodePg(pool, { schema });
  console.log('[db] Modo remoto (PostgreSQL)');
}

export const db = dbInstance;
export const pglite = pgliteClient;
export { schema };
