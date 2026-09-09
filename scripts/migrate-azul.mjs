import 'dotenv/config';
import pg from 'pg';

/**
 * Integración AZUL — delta ADITIVO e idempotente. Mismo patrón que migrate-jobs-v2.mjs.
 *   node scripts/migrate-azul.mjs
 * Alternativa: pegar scripts/azul-schema.sql en el SQL Editor de Supabase.
 */
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = [
  `ALTER TYPE bid_method ADD VALUE IF NOT EXISTS 'azul'`,

  `CREATE TABLE IF NOT EXISTS azul_payments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     bid_id uuid NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
     order_number text NOT NULL,
     amount integer NOT NULL,
     itbis integer NOT NULL DEFAULT 0,
     currency_code text,
     status text NOT NULL DEFAULT 'created',
     azul_order_id text,
     authorization_code text,
     rrn text,
     iso_code text,
     response_code text,
     response_message text,
     error_description text,
     date_time text,
     card_number_masked text,
     data_vault_brand text,
     raw jsonb,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS azul_payments_order_uniq ON azul_payments (order_number)`,
  `CREATE INDEX IF NOT EXISTS azul_payments_bid_idx ON azul_payments (bid_id)`,

  `ALTER TABLE azul_payments ENABLE ROW LEVEL SECURITY`,
  `REVOKE ALL ON azul_payments FROM anon, authenticated`,
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
console.log('\nMigración de AZUL completada.');
process.exit(0);
