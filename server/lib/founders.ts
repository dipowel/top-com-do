import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { db } from '../db';
import { bids, profiles, categories } from '../../shared/schema';
import { getActiveRound } from './rounds';
import { checkDethronements, notifyUser } from './notify';
import { audit } from './audit';
import { pingIndexNow } from './indexnow';

/** Marca cualquier puja del Programa Fundadores — nunca se crea por otra vía. */
export const FOUNDER_REFERENCE = 'FUNDADOR_BETA';

/** Refresca la puja de Fundador si tiene más de esto — siempre dentro de la ventana de 7 días. */
const REFRESH_AFTER_DAYS = 5;

/**
 * ¿Sigue abierto el Programa Fundadores para NUEVOS negocios? `BETA_CLOSED=true` lo cierra a
 * mano antes de llegar al cupo; `MAX_BETA_BUSINESSES` (por defecto 250) lo cierra al llegar.
 * Los Fundadores ya admitidos conservan su beneficio siempre (ver `refreshFounderBids`),
 * cierre o no — esto solo decide si se admite a alguien más.
 */
export function isBetaOpen(currentFounderCount: number): boolean {
  if ((process.env.BETA_CLOSED || '').trim().toLowerCase() === 'true') return false;
  const max = Number(process.env.MAX_BETA_BUSINESSES) || 250;
  return currentFounderCount < max;
}

/** Monto (RD$) de la puja que se regala — decreciente por orden de llegada, para que el
 *  Fundador #1 siempre quede por encima del #2, el #2 del #3, etc. Rango ~RD$101–RD$350:
 *  números reales y modestos, no cifras infladas que se vean falsas en ningún reporte. */
export function founderGrantAmount(founderNumber: number): number {
  return 100 + Math.max(1, 251 - founderNumber);
}

/**
 * Da de alta la puja gratis de un Fundador (una sola vez por negocio). Reutiliza la tabla de
 * `bids` tal cual — es una puja real, verificada, con `method:'credit'` (el mismo método que
 * ya usan los bonos de referido) — pero NO reutiliza `creditVerifiedBid()` porque esa función
 * manda un correo de "recibo de pago" y una notificación de "tu pago se confirmó": decirle a
 * un Fundador que "pagó" algo que nunca pagó sería justo el tipo de dato falso que este
 * proyecto evita. Aquí se reutilizan sus mismas piezas internas (`checkDethronements`,
 * `pingIndexNow`, `audit`, `notifyUser`) con un mensaje honesto en su lugar.
 */
export async function grantFounderBid(
  profileId: string,
  founderNumber: number,
): Promise<'granted' | 'already' | 'no_owner'> {
  const already = (
    await db
      .select({ id: bids.id })
      .from(bids)
      .where(and(eq(bids.profileId, profileId), eq(bids.reference, FOUNDER_REFERENCE)))
      .limit(1)
  )[0];
  if (already) return 'already';

  const prof = (
    await db
      .select({ ownerUserId: profiles.ownerUserId, province: profiles.province, categorySlug: categories.slug })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.id, profileId))
      .limit(1)
  )[0];
  if (!prof?.ownerUserId) return 'no_owner';

  const round = await getActiveRound();
  const amountDop = founderGrantAmount(founderNumber);

  const inserted = await db
    .insert(bids)
    .values({
      profileId,
      userId: prof.ownerUserId,
      roundId: round.id,
      amountDop: amountDop.toFixed(2),
      currency: 'DOP',
      amountOriginal: amountDop.toFixed(2),
      fxRate: '1.0000',
      method: 'credit',
      status: 'verified',
      verifiedAt: new Date(),
      reference: FOUNDER_REFERENCE,
    })
    .returning();
  const bid = inserted[0]!;

  await checkDethronements(profileId);

  const prov = prof.province && prof.province !== 'todo-rd' ? prof.province : null;
  pingIndexNow([
    '/',
    `/p/${profileId}`,
    `/rd/${prof.categorySlug}`,
    ...(prov ? [`/rd/${prof.categorySlug}/${prov}`] : []),
  ]);

  await notifyUser(prof.ownerUserId, {
    type: 'founder.granted',
    title: '🎉 ¡Bienvenido al Programa Fundadores!',
    body: `Eres el Fundador #${founderNumber} — tu negocio ya aparece en el ranking, gratis y sin tarjeta.`,
    url: `/p/${profileId}`,
  });
  await audit(null, 'founder.granted', 'bid', bid.id, { profileId, founderNumber, amountDop });

  return 'granted';
}

/**
 * Corre dentro del cron diario que ya existe (`jobs-maintenance`): a cada Fundador le desliza
 * hacia adelante el `verifiedAt` de su MISMA puja (nunca crea una fila nueva, para que su
 * "inversión" nunca se vea creciendo) en cuanto esa puja empieza a acercarse al borde de la
 * ventana móvil de 7 días. Así nunca cae fuera de la ventana mientras sea Fundador — de por
 * vida, sin importar si el Programa ya cerró para negocios nuevos.
 */
export async function refreshFounderBids(): Promise<{ checked: number; refreshed: number }> {
  const cutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * 86_400_000);
  const rows = await db
    .select({ id: bids.id })
    .from(bids)
    .innerJoin(profiles, eq(profiles.id, bids.profileId))
    .where(
      and(
        eq(bids.reference, FOUNDER_REFERENCE),
        eq(bids.status, 'verified'),
        isNotNull(profiles.founderNumber),
        lt(bids.verifiedAt, cutoff),
      ),
    );
  for (const row of rows) {
    await db.update(bids).set({ verifiedAt: new Date() }).where(eq(bids.id, row.id));
  }
  return { checked: rows.length, refreshed: rows.length };
}
