import 'dotenv/config';
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Respaldo lógico de toda la base de datos de producción, tabla por tabla, a JSON — sin
 * depender de `pg_dump` (no disponible en este entorno Windows). Esto es la Fase 0 de la
 * migración al modelo orgánico: respaldo obligatorio antes de tocar cualquier esquema.
 *
 * IMPORTANTE: Supabase (donde vive esta base de datos) ya mantiene sus propios backups
 * automáticos diarios — revisa también Dashboard de Supabase → Database → Backups como
 * respaldo primario con restauración de un clic. Este script es un respaldo PORTÁTIL
 * adicional, bajo tu control, independiente de la consola de Supabase.
 *
 * Uso: node scripts/db-backup.mjs
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join('backups', stamp);
  mkdirSync(dir, { recursive: true });

  const { rows: tables } = await pool.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );

  const manifest = { createdAt: new Date().toISOString(), tables: [] };

  for (const { table_name } of tables) {
    const { rows } = await pool.query(`select * from "${table_name}"`);
    writeFileSync(path.join(dir, `${table_name}.json`), JSON.stringify(rows, null, 2));
    manifest.tables.push({ name: table_name, rows: rows.length });
    console.log(`  → ${table_name}: ${rows.length} fila(s)`);
  }

  writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n[db-backup] Completo: ${dir}`);
  console.log(`[db-backup] Total tablas: ${manifest.tables.length}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
