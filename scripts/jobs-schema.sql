-- ============================================================================
-- Módulo de Empleos — delta de esquema (tablas + enums nuevos)
-- Opción A: `npm run db:push` (drizzle-kit push --force, diffea contra la BD viva).
-- Opción B: pegar ESTE archivo en el SQL Editor de Supabase.
-- Idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."job_type" AS ENUM('full_time','part_time','temporary','internship','freelance','contract');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."work_mode" AS ENUM('onsite','hybrid','remote');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."salary_period" AS ENUM('monthly','weekly','daily','hourly','negotiable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."job_status" AS ENUM('draft','published','expired','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."source_type" AS ENUM('direct','api','feed','partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."source_auth" AS ENUM('none','requested','authorized','denied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "job_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "platform" text NOT NULL,
  "base_url" text,
  "source_type" "source_type" NOT NULL,
  "authorization_status" "source_auth" DEFAULT 'none' NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "last_run_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "job_sources_platform_unique" UNIQUE("platform")
);

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "requirements" text,
  "responsibilities" text,
  "company_id" uuid,
  "company_name" text NOT NULL,
  "posted_by_user_id" uuid NOT NULL,
  "category" text NOT NULL,
  "subcategory" text,
  "province" text,
  "city" text,
  "location_text" text,
  "latitude" numeric(10, 7),
  "longitude" numeric(10, 7),
  "job_type" "job_type" NOT NULL,
  "work_mode" "work_mode" NOT NULL,
  "salary_min" integer,
  "salary_max" integer,
  "salary_currency" text DEFAULT 'DOP' NOT NULL,
  "salary_period" "salary_period",
  "application_url" text,
  "application_email" text,
  "contact_whatsapp" text,
  "status" "job_status" DEFAULT 'published' NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "source_id" uuid,
  "source_platform" text DEFAULT 'direct',
  "source_url" text,
  "source_job_id" text,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "jobs_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "job_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "reporter_user_id" uuid,
  "reason" text NOT NULL,
  "detail" text,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_profiles_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."profiles"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_posted_by_user_id_users_id_fk"
    FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_job_sources_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_job_id_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_reporter_user_id_users_id_fk"
    FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "jobs_status_published_idx" ON "jobs" ("status","published_at");
CREATE INDEX IF NOT EXISTS "jobs_category_idx" ON "jobs" ("category");
CREATE INDEX IF NOT EXISTS "jobs_province_idx" ON "jobs" ("province");
CREATE INDEX IF NOT EXISTS "jobs_city_idx" ON "jobs" ("city");
CREATE INDEX IF NOT EXISTS "jobs_company_idx" ON "jobs" ("company_id");
CREATE INDEX IF NOT EXISTS "jobs_expires_idx" ON "jobs" ("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_source_uniq" ON "jobs" ("source_platform","source_job_id");

-- Fuente "publicación directa" (única autorizada).
INSERT INTO "job_sources" ("name","platform","source_type","authorization_status","is_enabled")
VALUES ('Publicación directa','direct','direct','authorized',true)
ON CONFLICT ("platform") DO NOTHING;

-- RLS (defensa en profundidad; la app conecta como `postgres` y no la necesita).
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "jobs", "job_sources", "job_reports" FROM anon, authenticated;
