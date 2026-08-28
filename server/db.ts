import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from '../shared/schema';

const { Pool } = pkg;

const rawUrl = process.env.DATABASE_URL || '';
if (!rawUrl) {
  console.warn('[db] DATABASE_URL no está configurada — las consultas fallarán.');
}

const isLoopback = /@(localhost|127\.0\.0\.1)[:/]/.test(rawUrl);

const pool = new Pool({
  connectionString: rawUrl || undefined,
  ssl: rawUrl && !isLoopback ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX) || 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('[db] error de pool:', err.message));

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export { schema };
