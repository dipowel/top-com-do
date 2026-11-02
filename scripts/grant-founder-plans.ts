import 'dotenv/config';
import { and, eq, isNotNull, lt, or, isNull } from 'drizzle-orm';
import { db } from '../server/db';
import { profiles } from '../shared/schema';

const FOUNDER_PLAN_DAYS = 90;

/**
 * Ejecución única (a mano, contra producción): los Fundadores otorgados ANTES de que
 * `grantFounderBid()` empezara a regalar 3 meses de Verificado automáticamente (Fase 3) no
 * tienen ese plan todavía. Este script se los da, sin tocar a los que ya lo tengan o tengan
 * uno mejor vigente (idempotente — seguro de re-correr).
 *
 * Uso: npx tsx scripts/grant-founder-plans.ts
 */

async function main() {
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, founderNumber: profiles.founderNumber, plan: profiles.plan, planExpiresAt: profiles.planExpiresAt })
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.founderNumber),
        or(eq(profiles.plan, 'free'), isNull(profiles.planExpiresAt), lt(profiles.planExpiresAt, new Date())),
      ),
    );

  console.log(`[grant-founder-plans] ${rows.length} Fundador(es) sin plan Verificado vigente.`);
  for (const r of rows) {
    const planExpiresAt = new Date(Date.now() + FOUNDER_PLAN_DAYS * 86_400_000);
    await db.update(profiles).set({ plan: 'verificado', planExpiresAt }).where(eq(profiles.id, r.id));
    console.log(`  → #${r.founderNumber} ${r.name}: Verificado hasta ${planExpiresAt.toLocaleDateString('es-DO')}`);
  }
  console.log(`[grant-founder-plans] Completo. ${rows.length} negocio(s) actualizados.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
