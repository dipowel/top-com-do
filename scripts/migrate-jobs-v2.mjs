import 'dotenv/config';
import pg from 'pg';

/**
 * Empleos v2 — delta ADITIVO e idempotente. Mismo patrón que migrate-features.mjs.
 *   node scripts/migrate-jobs-v2.mjs
 * Alternativa: pegar scripts/jobs-schema-v2.sql en el SQL Editor de Supabase.
 */
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = [
  // Enums (van primero y solos).
  `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'pending_review'`,
  `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'possible_duplicate'`,
  `ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'removed'`,
  `ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'ats'`,

  `DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_trgm; EXCEPTION WHEN OTHERS THEN NULL; END $$`,

  // jobs: columnas nuevas.
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS street_address text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS postal_code text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS direct_apply boolean NOT NULL DEFAULT false`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_name text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dedupe_key text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS content_hash text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duplicate_of_id uuid`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS raw_payload jsonb`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS indexing_status text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS indexing_type text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS indexing_requested_at timestamptz`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS indexing_last_error text`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS removed_at timestamptz`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS removed_reason text`,
  `ALTER TABLE jobs ALTER COLUMN posted_by_user_id DROP NOT NULL`,
  `DO $$ BEGIN
     ALTER TABLE jobs ADD CONSTRAINT jobs_duplicate_of_id_jobs_id_fk
       FOREIGN KEY (duplicate_of_id) REFERENCES jobs(id) ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // job_sources: columnas nuevas.
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS feed_url text`,
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS config jsonb`,
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS auto_publish boolean NOT NULL DEFAULT false`,
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS default_category text`,
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS last_run_status text`,
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS last_error text`,
  `ALTER TABLE job_sources ADD COLUMN IF NOT EXISTS notes text`,

  // Bitácora de importación.
  `CREATE TABLE IF NOT EXISTS job_import_runs (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     source_id uuid REFERENCES job_sources(id) ON DELETE SET NULL,
     source_platform text NOT NULL,
     status text NOT NULL DEFAULT 'running',
     jobs_found integer NOT NULL DEFAULT 0,
     jobs_new integer NOT NULL DEFAULT 0,
     jobs_updated integer NOT NULL DEFAULT 0,
     jobs_duplicate integer NOT NULL DEFAULT 0,
     jobs_expired integer NOT NULL DEFAULT 0,
     jobs_removed integer NOT NULL DEFAULT 0,
     jobs_failed integer NOT NULL DEFAULT 0,
     error text,
     started_at timestamptz NOT NULL DEFAULT now(),
     finished_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,

  // Índices.
  `CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status)`,
  `CREATE INDEX IF NOT EXISTS jobs_source_platform_idx ON jobs (source_platform)`,
  `CREATE INDEX IF NOT EXISTS jobs_dedupe_key_idx ON jobs (dedupe_key)`,
  `CREATE INDEX IF NOT EXISTS jobs_content_hash_idx ON jobs (content_hash)`,
  `CREATE INDEX IF NOT EXISTS job_import_runs_source_idx ON job_import_runs (source_id, started_at)`,
  `DO $$ BEGIN
     CREATE INDEX IF NOT EXISTS jobs_title_trgm_idx ON jobs USING gin (lower(title) gin_trgm_ops);
   EXCEPTION WHEN undefined_object OR undefined_file THEN NULL; END $$`,

  // RLS de la tabla nueva.
  `ALTER TABLE job_import_runs ENABLE ROW LEVEL SECURITY`,
  `REVOKE ALL ON job_import_runs FROM anon, authenticated`,
];

for (const sql of statements) {
  process.stdout.write(`→ ${sql.split('\n')[0].slice(0, 70)} ... `);
  try {
    await pool.query(sql);
    console.log('OK');
  } catch (e) {
    console.log(`FALLÓ: ${e.message}`);
  }
}

await pool.end();
console.log('\nMigración de Empleos v2 completada.');
process.exit(0);
