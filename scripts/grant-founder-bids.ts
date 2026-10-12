import 'dotenv/config';
import { isNotNull } from 'drizzle-orm';
import { db } from '../server/db';
import { profiles } from '../shared/schema';
import { grantFounderBid } from '../server/lib/founders';

/**
 * Ejecución única (a mano, contra producción) tras correr `migrate-features.mjs`: ese script
 * ya le asignó `founder_number` a los negocios que ya existían — este les regala la puja
 * gratis correspondiente (los registros NUEVOS ya la reciben solos desde
 * `POST /api/profiles`, esto es solo para ponerse al día con los que ya estaban).
 */
async function main() {
  const rows = await db
    .select({ id: profiles.id, founderNumber: profiles.founderNumber, name: profiles.name })
    .from(profiles)
    .where(isNotNull(profiles.founderNumber));

  console.log(`[grant-founder-bids] ${rows.length} negocio(s) con founder_number asignado.`);
  let granted = 0;
  let already = 0;
  for (const r of rows) {
    const result = await grantFounderBid(r.id, r.founderNumber!);
    if (result === 'granted') {
      granted++;
      console.log(`  → #${r.founderNumber} ${r.name}: GRANTED`);
    } else {
      already++;
    }
  }
  console.log(`[grant-founder-bids] Completo. Nuevos: ${granted}, ya tenían puja: ${already}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
