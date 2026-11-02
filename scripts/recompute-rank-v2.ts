import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { profiles } from '../shared/schema';
import { recomputeProfileRankFields } from '../server/lib/rankingModel';

/**
 * Ejecución única (a mano, contra producción), tras aplicar el DDL de
 * `scripts/migrate-features.mjs`: recalcula rating_avg/reviews_count/fast_response_rate/
 * profile_completeness/rank_score de TODOS los perfiles activos ya existentes, reutilizando la
 * MISMA función que usará el recálculo on-write y el barrido del cron — una sola fuente de
 * verdad para la fórmula, nunca duplicada en SQL. Idempotente: se puede volver a correr sin
 * riesgo.
 *
 * Uso: npx tsx scripts/recompute-rank-v2.ts
 */

const BATCH_SIZE = 500;

async function main() {
  const all = await db
    .select({ id: profiles.id, name: profiles.name })
    .from(profiles)
    .where(eq(profiles.isActive, true));

  console.log(`[recompute-rank-v2] ${all.length} perfil(es) activo(s) a procesar.`);
  let done = 0;
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    for (const p of batch) {
      await recomputeProfileRankFields(p.id);
      done++;
    }
    console.log(`  → ${done}/${all.length} procesados...`);
  }
  console.log(`[recompute-rank-v2] Completo. ${done} perfil(es) actualizados.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
