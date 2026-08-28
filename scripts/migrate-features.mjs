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
