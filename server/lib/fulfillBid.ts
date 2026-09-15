import { eq } from 'drizzle-orm';
import { db } from '../db';
import { bids, profiles, categories, users } from '../../shared/schema';
import { onBidVerified } from './rewards';
import { checkDethronements, notifyUser } from './notify';
import { audit } from './audit';
import { pingIndexNow } from './indexnow';
import { sendEmail, receiptEmailHtml } from './email';
import { buildOrderNumber } from './orderNumber';
import { formatDOP } from '../../shared/fx';

/**
 * Acredita una puja pagada. Idempotente: si ya está `verified` no vuelve a
 * acreditar. La actualización de `azul_payments` la hace el llamador ANTES de
 * invocar esto.
 */
export async function creditVerifiedBid(opts: {
  bidId: string;
  /** Monto realmente cobrado (DOP). Si difiere del de la puja, se ajusta y se audita. */
  finalDop: number | null;
  /** Referencia legible del pago (p. ej. "AZUL OK1234"). */
  reference: string;
  /** Etiqueta de la pasarela para la notificación al usuario. */
  providerLabel: string;
}): Promise<'verified' | 'already' | 'not_found'> {
  const bid = (await db.select().from(bids).where(eq(bids.id, opts.bidId)).limit(1))[0];
  if (!bid) return 'not_found';
  if (bid.status === 'verified') return 'already';

  const expectedDop = Number(bid.amountDop);
  const finalDop = opts.finalDop != null && opts.finalDop > 0 ? opts.finalDop : expectedDop;

  await db
    .update(bids)
    .set({
      status: 'verified',
      verifiedAt: new Date(),
      amountDop: finalDop.toFixed(2),
      amountOriginal: finalDop.toFixed(2),
      reference: opts.reference,
    })
    .where(eq(bids.id, bid.id));

  if (opts.finalDop != null && Math.abs(finalDop - expectedDop) > 0.009) {
    await audit(null, 'bid.amount.adjusted', 'bid', bid.id, { expectedDop, paidDop: opts.finalDop });
  }

  await onBidVerified(bid.id);
  await checkDethronements(bid.profileId);

  const prof = (
    await db
      .select({ name: profiles.name, province: profiles.province, categorySlug: categories.slug })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.id, bid.profileId))
      .limit(1)
  )[0];

  if (prof) {
    const prov = prof.province && prof.province !== 'todo-rd' ? prof.province : null;
    pingIndexNow([
      '/',
      `/p/${bid.profileId}`,
      `/rd/${prof.categorySlug}`,
      ...(prov ? [`/rd/${prof.categorySlug}/${prov}`] : []),
    ]);
  }

  await notifyUser(bid.userId, {
    type: 'bid.verified',
    title: `✅ Puja verificada: ${formatDOP(finalDop)}`,
    body: `Tu pago con ${opts.providerLabel} se confirmó. Tu puja por ${prof?.name ?? 'el perfil'} ya cuenta en el ranking.`,
    url: `/p/${bid.profileId}`,
  });
  await audit(null, 'bid.verified', 'bid', bid.id, { provider: opts.providerLabel, reference: opts.reference });

  const buyer = (
    await db.select({ email: users.email }).from(users).where(eq(users.id, bid.userId)).limit(1)
  )[0];
  if (buyer?.email) {
    const orderNumber = buildOrderNumber(bid.id, bid.createdAt);
    const concept = `Puja por visibilidad en el ranking — ${prof?.name ?? 'tu negocio'}`;
    try {
      await sendEmail({
        to: buyer.email,
        subject: `🧾 Recibo de tu pago — ${orderNumber}`,
        html: receiptEmailHtml({
          businessName: prof?.name ?? 'tu negocio',
          concept,
          orderNumber,
          amountDop: finalDop,
          dateLabel: new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' }),
          bidId: bid.id,
        }),
      });
    } catch (e) {
      console.error('[fulfillBid] correo de recibo falló:', (e as Error).message);
    }
  }

  return 'verified';
}
