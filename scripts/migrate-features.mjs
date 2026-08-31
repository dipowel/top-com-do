import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = [
  `ALTER TYPE bid_method ADD VALUE IF NOT EXISTS 'credit'`,

  `DO $$ BEGIN
     CREATE TYPE referral_status AS ENUM ('pending','eligible','approved','rejected');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_code text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance_dop numeric(12,2) NOT NULL DEFAULT '0'`,
  `DO $$ BEGIN
     ALTER TABLE users ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subcategory text`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address text`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude numeric(10,7)`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude numeric(10,7)`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS province text`,
  `CREATE INDEX IF NOT EXISTS profiles_province_idx ON profiles (province)`,

  `CREATE INDEX IF NOT EXISTS bids_user_idx ON bids (user_id)`,

  `CREATE TABLE IF NOT EXISTS notifications (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     type text NOT NULL,
     title text NOT NULL,
     body text NOT NULL,
     url text,
     meta jsonb,
     read_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read_at)`,

  `CREATE TABLE IF NOT EXISTS rank_leaders (
     scope_key text PRIMARY KEY,
     leader_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
     leader_total_dop numeric(12,2) NOT NULL DEFAULT '0',
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS referrals (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     referred_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     status referral_status NOT NULL DEFAULT 'pending',
     bonus_dop numeric(12,2) NOT NULL DEFAULT '100',
     triggering_bid_id uuid REFERENCES bids(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     approved_at timestamptz,
     approved_by_user_id uuid REFERENCES users(id)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_uniq ON referrals (referred_user_id)`,
  `CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_user_id)`,

  `CREATE TABLE IF NOT EXISTS credit_transactions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     amount_dop numeric(12,2) NOT NULL,
     type text NOT NULL,
     ref_id text,
     note text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,

  `DO $$ BEGIN
     CREATE TYPE review_status AS ENUM ('published','flagged','hidden');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS reviews (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
     comment text,
     status review_status NOT NULL DEFAULT 'published',
     owner_reply text,
     owner_reply_at timestamptz,
     ip_hash text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reviews_profile_user_uniq ON reviews (profile_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS reviews_profile_idx ON reviews (profile_id, status)`,
  `CREATE INDEX IF NOT EXISTS reviews_ip_idx ON reviews (ip_hash, created_at)`,

  `DO $$ BEGIN
     CREATE TYPE account_type AS ENUM ('consumer','merchant','admin');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'consumer'`,
  // Backfill: quien tiene role admin -> 'admin'; quien ya publicó un negocio -> 'merchant'.
  `UPDATE users SET account_type = 'admin' WHERE role IN ('admin','superadmin') AND account_type <> 'admin'`,
  `UPDATE users u SET account_type = 'merchant'
     WHERE account_type = 'consumer'
     AND EXISTS (SELECT 1 FROM profiles p WHERE p.owner_user_id = u.id)`,

  // --- Dodo Payments (pasarela actual; sustituye a PayPal y transferencia) ---
  `ALTER TYPE bid_method ADD VALUE IF NOT EXISTS 'dodo'`,
  `CREATE TABLE IF NOT EXISTS dodo_payments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     bid_id uuid NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
     session_id text,
     payment_id text,
     status text NOT NULL DEFAULT 'created',
     tier_dop integer NOT NULL,
     raw jsonb,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS dodo_payments_bid_idx ON dodo_payments (bid_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dodo_payments_payment_uniq ON dodo_payments (payment_id)`,
  // Subasta dinámica: el monto de la puja ya no es un "nivel" fijo.
  `ALTER TABLE dodo_payments DROP COLUMN IF EXISTS tier_dop`,
  `ALTER TABLE dodo_payments ADD COLUMN IF NOT EXISTS amount_dop numeric(12,2) NOT NULL DEFAULT 0`,

  // Nuevas categorías principales (subcategorías van en shared/categories.ts, no en BD).
  `INSERT INTO categories (slug, name, sort_order) VALUES
     ('ocio', '🎉 Ocio, Discotecas y Lounge', 9),
     ('educacion', '🎓 Educación y Academias', 10),
     ('mascotas', '🐾 Mascotas y Veterinarias', 11)
   ON CONFLICT (slug) DO UPDATE
     SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true`,
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
console.log('\nMigración de funciones completada.');
process.exit(0);
