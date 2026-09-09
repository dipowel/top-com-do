-- ============================================================================
-- Integración AZUL — delta ADITIVO e idempotente.
--   Opción A: `npm run db:push`
--   Opción B: pegar este archivo en el SQL Editor de Supabase.
-- `ALTER TYPE ... ADD VALUE` va primero y solo (fuera de transacción).
-- ============================================================================

ALTER TYPE "bid_method" ADD VALUE IF NOT EXISTS 'azul';

CREATE TABLE IF NOT EXISTS "azul_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bid_id" uuid NOT NULL REFERENCES "bids"("id") ON DELETE CASCADE,
  "order_number" text NOT NULL,
  "amount" integer NOT NULL,
  "itbis" integer NOT NULL DEFAULT 0,
  "currency_code" text,
  "status" text NOT NULL DEFAULT 'created',
  "azul_order_id" text,
  "authorization_code" text,
  "rrn" text,
  "iso_code" text,
  "response_code" text,
  "response_message" text,
  "error_description" text,
  "date_time" text,
  "card_number_masked" text,
  "data_vault_brand" text,
  "raw" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "azul_payments_order_uniq" ON "azul_payments" ("order_number");
CREATE INDEX IF NOT EXISTS "azul_payments_bid_idx" ON "azul_payments" ("bid_id");

ALTER TABLE "azul_payments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "azul_payments" FROM anon, authenticated;
