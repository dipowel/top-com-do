import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
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

/** Cuántos negocios ya son Fundadores ahora mismo — única fuente, para no repetir la query. */
export async function currentFounderCount(): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(isNotNull(profiles.founderNumber));
  return n;
}

/** Conveniencia: `isBetaOpen()` ya resuelto contra el conteo actual de la base de datos. */
export async function isBetaOpenNow(): Promise<boolean> {
  return isBetaOpen(await currentFounderCount());
}

/** Monto (RD$) de la puja que se regala — en 4 bloques redondos de RD$100 según orden de
 *  llegada (400 → 300 → 200 → 100), nunca cifras sueltas como 349/348/347 que se vean
 *  descontroladas en la interfaz. Varios Fundadores de un mismo bloque pueden compartir monto:
 *  no afecta su posición real porque el ranking separa por categoría/provincia. */
export function founderGrantAmount(founderNumber: number): number {
  const max = Number(process.env.MAX_BETA_BUSINESSES) || 250;
  const tierSize = Math.ceil(max / 4);
  const tier = Math.min(4, Math.ceil(founderNumber / tierSize));
  return (5 - tier) * 100;
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
    .select({ id: bids.id, founderNumber: profiles.founderNumber })
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
    // Recalcula el monto con la fórmula vigente — se autocorrige solo si alguna vez cambia.
    const amountDop = founderGrantAmount(row.founderNumber!);
    await db
      .update(bids)
      .set({ verifiedAt: new Date(), amountDop: amountDop.toFixed(2), amountOriginal: amountDop.toFixed(2) })
      .where(eq(bids.id, row.id));
  }
  return { checked: rows.length, refreshed: rows.length };
}
