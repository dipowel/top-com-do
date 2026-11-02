import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Restaura un respaldo generado por `scripts/db-backup.mjs`: por cada tabla, BORRA su
 * contenido actual (TRUNCATE ... CASCADE) y vuelve a insertar las filas guardadas.
 *
 * ADVERTENCIA: esto reemplaza el contenido de las tablas en la base de datos a la que apunte
 * DATABASE_URL en ese momento. Úsalo solo para deshacer una migración fallida, nunca contra
 * producción sin confirmar primero que es exactamente lo que quieres.
 *
 * Uso: node scripts/db-restore.mjs backups/2026-11-02T.../
 */

const dir = process.argv[2];
if (!dir) {
  console.error('Uso: node scripts/db-restore.mjs <carpeta-de-backup>');
  process.exit(1);
}

// Orden de restauración: padres antes que hijos (respeta las FK), inverso para TRUNCATE.
const TABLE_ORDER = [
  'categories', 'users', 'job_sources', 'rounds', 'profiles', 'bank_accounts',
  'bids', 'jobs', 'reviews', 'favorites', 'referrals', 'credit_transactions',
  'payment_receipts', 'azul_payments', 'dodo_payments', 'paypal_orders',
  'job_import_runs', 'job_reports', 'job_leads', 'business_events',
  'notifications', 'rank_leaders', 'rank_leader_history', 'audit_log',
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const manifest = JSON.parse(readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
  const available = new Set(readdirSync(dir).map((f) => f.replace(/\.json$/, '')));
  const order = TABLE_ORDER.filter((t) => available.has(t));
  const extra = manifest.tables.map((t) => t.name).filter((n) => !order.includes(n) && n !== '_manifest');
  const tables = [...order, ...extra];

  console.log(`[db-restore] Restaurando desde ${dir} (${tables.length} tabla(s))`);

  // TRUNCATE todas primero, en orden inverso (hijos antes que padres), con CASCADE por si acaso.
  for (const name of [...tables].reverse()) {
    await pool.query(`TRUNCATE TABLE "${name}" CASCADE`);
  }

  for (const name of tables) {
    const rows = JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8'));
    if (!rows.length) {
      console.log(`  → ${name}: 0 filas (sin datos que restaurar)`);
      continue;
    }
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(', ');
    for (const row of rows) {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map((c) => row[c]);
      await pool.query(`INSERT INTO "${name}" (${colList}) VALUES (${placeholders})`, values);
    }
    console.log(`  → ${name}: ${rows.length} fila(s) restaurada(s)`);
  }

  console.log('[db-restore] Completo.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
