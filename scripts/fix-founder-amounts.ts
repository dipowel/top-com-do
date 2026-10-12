import 'dotenv/config';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../server/db';
import { bids, profiles } from '../shared/schema';
import { founderGrantAmount, FOUNDER_REFERENCE } from '../server/lib/founders';

/**
 * Ejecución única (a mano, contra producción): corrige el `amountDop`/`amountOriginal` de las
 * pujas `FUNDADOR_BETA` ya otorgadas con la fórmula vieja (números sueltos como 349, 348, 347)
 * para que queden en los bloques redondos de RD$100 de la fórmula nueva. Nunca inserta una
 * fila — actualiza la misma puja existente de cada Fundador.
 */
async function main() {
  const rows = await db
    .select({ id: profiles.id, founderNumber: profiles.founderNumber, name: profiles.name })
    .from(profiles)
    .where(isNotNull(profiles.founderNumber));

  console.log(`[fix-founder-amounts] ${rows.length} negocio(s) con founder_number asignado.`);
  let updated = 0;
  for (const r of rows) {
    const amountDop = founderGrantAmount(r.founderNumber!);
    const result = await db
      .update(bids)
      .set({ amountDop: amountDop.toFixed(2), amountOriginal: amountDop.toFixed(2) })
      .where(and(eq(bids.profileId, r.id), eq(bids.reference, FOUNDER_REFERENCE)))
      .returning({ id: bids.id });
    if (result.length) {
      updated++;
      console.log(`  → #${r.founderNumber} ${r.name}: RD$${amountDop}`);
    } else {
      console.log(`  → #${r.founderNumber} ${r.name}: sin puja FUNDADOR_BETA (omitido)`);
    }
  }
  console.log(`[fix-founder-amounts] Completo. Actualizadas: ${updated}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
