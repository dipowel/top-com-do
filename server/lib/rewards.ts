import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { creditTransactions, referrals, users, bids, profiles } from '../../shared/schema';
import { audit } from './audit';
import { notifyUser } from './notify';
import { formatDOP } from '../../shared/fx';
import { isNewModelEnabled } from './rankingModel';

/** Ranking v2: 1 mes de plan Verificado — mismo patrón de "sumar al vencimiento vigente" que
 *  `approvePlanPayment()`. Sustituye el bono en RD$ del modelo de pujas. */
const REFERRAL_PLAN_DAYS = 30;

export const REFERRAL_BONUS_DOP = 100;
export const MIN_VALID_BID_DOP = 100;

export function generateReferralCode(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'TOP';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rand}`;
}

/** Suma (o resta, si amount < 0) crédito al usuario y registra la transacción. */
export async function moveCredit(
  userId: string,
  amountDop: number,
  type: 'referral_bonus' | 'bid_payment' | 'admin_adjust',
  refId: string | null,
  note: string,
): Promise<void> {
  await db.insert(creditTransactions).values({
    userId,
    amountDop: amountDop.toFixed(2),
    type,
    refId: refId ?? undefined,
    note,
  });
  await db
    .update(users)
    .set({
      creditBalanceDop: sql`coalesce(${users.creditBalanceDop}, 0) + ${amountDop.toFixed(2)}::numeric`,
    })
    .where(eq(users.id, userId));
}

/**
 * Se llama cuando el admin VERIFICA una puja. Si el que puja fue referido y la
 * puja es válida (>= RD$100), el referido pasa a `eligible` — pero NO se acredita
 * nada todavía: el admin debe aprobarlo manualmente en el panel de Referidos.
 */
export async function onBidVerified(bidId: string): Promise<void> {
  const bid = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
  if (!bid[0]) return;
  if (Number(bid[0].amountDop) < MIN_VALID_BID_DOP) return;

  const ref = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredUserId, bid[0].userId), eq(referrals.status, 'pending')))
    .limit(1);
  if (!ref[0]) return;

  await db
    .update(referrals)
    .set({ status: 'eligible', triggeringBidId: bidId })
    .where(eq(referrals.id, ref[0].id));
  await audit(null, 'referral.eligible', 'referral', ref[0].id, { bidId });
}

/**
 * Ranking v2: se llama cuando se APRUEBA el pago de un plan (Verificado/Destacado). Mismo
 * efecto que `onBidVerified()` pero sin mínimo de monto (los planes ya tienen precio fijo) —
 * el referido pasa a `eligible`, el admin sigue aprobando el bono a mano en el panel.
 */
export async function onPlanPaymentApproved(payerUserId: string): Promise<void> {
  const ref = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredUserId, payerUserId), eq(referrals.status, 'pending')))
    .limit(1);
  if (!ref[0]) return;

  await db.update(referrals).set({ status: 'eligible' }).where(eq(referrals.id, ref[0].id));
  await audit(null, 'referral.eligible', 'referral', ref[0].id, { via: 'plan_payment' });
}

/** Acredita el bono al referente. Solo si el referido está `eligible`. Bajo el ranking v2 el
 *  bono es 1 mes del plan Verificado (no RD$) — si el referente no tiene ningún negocio activo
 *  todavía, cae al crédito en RD$ de siempre para que el bono nunca se pierda. */
export async function approveReferral(referralId: string, adminUserId: string): Promise<void> {
  const ref = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
  if (!ref[0]) throw new Error('Referido no encontrado');
  if (ref[0].status === 'approved') return;
  if (ref[0].status !== 'eligible') {
    throw new Error('El referido aún no tiene una puja válida verificada');
  }

  const bonus = Number(ref[0].bonusDop);
  let rewardLabel = formatDOP(bonus);
  let notifyBody = 'Tu invitado hizo una puja válida. Usa el saldo para anunciarte gratis.';

  const myProfiles = isNewModelEnabled()
    ? await db
        .select({ id: profiles.id, planExpiresAt: profiles.planExpiresAt })
        .from(profiles)
        .where(and(eq(profiles.ownerUserId, ref[0].referrerUserId), eq(profiles.isActive, true)))
    : [];

  if (myProfiles.length) {
    for (const p of myProfiles) {
      const base = p.planExpiresAt && p.planExpiresAt > new Date() ? p.planExpiresAt : new Date();
      const planExpiresAt = new Date(base.getTime() + REFERRAL_PLAN_DAYS * 86_400_000);
      await db
        .update(profiles)
        .set({ plan: 'verificado', planExpiresAt, planExpiryWarnedAt: null })
        .where(eq(profiles.id, p.id));
    }
    rewardLabel = '1 mes del plan Verificado';
    notifyBody = 'Tu invitado activó un plan en Top — tu negocio ya tiene 1 mes de Verificado de regalo.';
  } else {
    await moveCredit(ref[0].referrerUserId, bonus, 'referral_bonus', referralId, 'Bono por referido aprobado');
  }

  await db
    .update(referrals)
    .set({ status: 'approved', approvedAt: new Date(), approvedByUserId: adminUserId })
    .where(eq(referrals.id, referralId));
  await audit(adminUserId, 'referral.approved', 'referral', referralId, { bonus, rewardLabel });
  await notifyUser(ref[0].referrerUserId, {
    type: 'referral.credited',
    title: `🎉 Bono de referido: ${rewardLabel}`,
    body: notifyBody,
    url: '/perfil',
  });
}

export async function rejectReferral(referralId: string, adminUserId: string): Promise<void> {
  await db.update(referrals).set({ status: 'rejected' }).where(eq(referrals.id, referralId));
  await audit(adminUserId, 'referral.rejected', 'referral', referralId);
}
