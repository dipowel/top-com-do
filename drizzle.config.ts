import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Para migraciones se prefiere una conexión de sesión (no el transaction pooler).
 * Con Supabase eso significa el puerto 5432 en lugar de 6543.
 * Puedes sobreescribirlo con MIGRATION_DATABASE_URL.
 */
const url =
  process.env.MIGRATION_DATABASE_URL ||
  (process.env.DATABASE_URL || '').replace('pooler.supabase.com:6543', 'pooler.supabase.com:5432');

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url, ssl: url.includes('supabase.com') ? 'require' : undefined },
  verbose: true,
});
