-- ============================================================================
-- Empleos v2 — delta ADITIVO sobre jobs-schema.sql
-- Opción A: `npm run db:push` (drizzle-kit push --force, diffea contra la BD viva).
-- Opción B: pegar ESTE archivo en el SQL Editor de Supabase.
-- Idempotente y additivo: NO borra ni renombra nada. Se puede correr varias veces.
--
-- IMPORTANTE: `ALTER TYPE ... ADD VALUE` no puede ir dentro de un bloque de
-- transacción junto a otras sentencias en algunas versiones de PostgreSQL.
-- Por eso los `ADD VALUE` van PRIMERO, cada uno en su propia sentencia.
-- ============================================================================

-- 1) Nuevos valores de enum (primero y solos) -------------------------------
ALTER TYPE "public"."job_status"  ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "public"."job_status"  ADD VALUE IF NOT EXISTS 'possible_duplicate';
ALTER TYPE "public"."job_status"  ADD VALUE IF NOT EXISTS 'removed';
ALTER TYPE "public"."source_type" ADD VALUE IF NOT EXISTS 'ats';

-- 2) Extensión para deduplicación por similitud (N5). Si el rol no puede
--    crearla, se ignora y el importador simplemente omite el nivel 5.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN insufficient_privilege OR OTHERS THEN NULL; END $$;

-- 3) Columnas nuevas en jobs ------------------------------------------------
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "street_address" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "direct_apply" boolean DEFAULT false NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "source_name" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "content_hash" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "duplicate_of_id" uuid;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "raw_payload" jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "indexing_status" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "indexing_type" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "indexing_requested_at" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "indexing_last_error" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "removed_reason" text;

-- Las vacantes importadas no tienen "usuario que publicó".
ALTER TABLE "jobs" ALTER COLUMN "posted_by_user_id" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_duplicate_of_id_jobs_id_fk"
    FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."jobs"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Columnas nuevas en job_sources --------------------------------------
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "feed_url" text;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "config" jsonb;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "auto_publish" boolean DEFAULT false NOT NULL;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "default_category" text;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "last_run_status" text;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "last_error" text;
ALTER TABLE "job_sources" ADD COLUMN IF NOT EXISTS "notes" text;

-- 5) Bitácora de importación --------------------------------------------
CREATE TABLE IF NOT EXISTS "job_import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid,
  "source_platform" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "jobs_found" integer DEFAULT 0 NOT NULL,
  "jobs_new" integer DEFAULT 0 NOT NULL,
  "jobs_updated" integer DEFAULT 0 NOT NULL,
  "jobs_duplicate" integer DEFAULT 0 NOT NULL,
  "jobs_expired" integer DEFAULT 0 NOT NULL,
  "jobs_removed" integer DEFAULT 0 NOT NULL,
  "jobs_failed" integer DEFAULT 0 NOT NULL,
  "error" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "job_import_runs" ADD CONSTRAINT "job_import_runs_source_id_job_sources_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Índices nuevos ----------------------------------------------------
CREATE INDEX IF NOT EXISTS "jobs_status_idx"          ON "jobs" ("status");
CREATE INDEX IF NOT EXISTS "jobs_source_platform_idx" ON "jobs" ("source_platform");
CREATE INDEX IF NOT EXISTS "jobs_dedupe_key_idx"      ON "jobs" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "jobs_content_hash_idx"    ON "jobs" ("content_hash");
CREATE INDEX IF NOT EXISTS "job_import_runs_source_idx" ON "job_import_runs" ("source_id","started_at");

-- Índice trigram para la deduplicación N5 (si pg_trgm está disponible).
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "jobs_title_trgm_idx" ON "jobs" USING gin (lower("title") gin_trgm_ops);
EXCEPTION WHEN undefined_object OR undefined_file THEN NULL; END $$;

-- 7) RLS en la tabla nueva ------------------------------------------
ALTER TABLE "job_import_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "job_import_runs" FROM anon, authenticated;
