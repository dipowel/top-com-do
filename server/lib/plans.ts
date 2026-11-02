import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { db } from '../db';
import { profiles, planPayments, featuredSlots } from '../../shared/schema';
import { getPlanPrices } from './settings';
import { notifyUser, notifyAdmins } from './notify';
import { audit } from './audit';
import { onPlanPaymentApproved } from './rewards';

const MAX_FEATURED_PER_SCOPE = 3;
const PLAN_DURATION_DAYS = 30;
const WARN_BEFORE_DAYS = 3;

/** Cuántos espacios "Destacado" activos hay ahora mismo en esta categoría × provincia. */
export async function activeFeaturedCount(categoryId: string, province: string): Promise<number> {
  const rows = await db
    .select({ id: featuredSlots.id })
    .from(featuredSlots)
    .where(and(eq(featuredSlots.categoryId, categoryId), eq(featuredSlots.province, province), gt(featuredSlots.endsAt, new Date())));
  return rows.length;
}

/** Cupo libre de Destacado en una categoría×provincia (0 si está lleno — el botón dice "Lista de espera"). */
export async function featuredSlotsRemaining(categoryId: string, province: string): Promise<number> {
  const used = await activeFeaturedCount(categoryId, province);
  return Math.max(0, MAX_FEATURED_PER_SCOPE - used);
}

/** El negocio sube su comprobante — queda `pending` hasta que un admin lo revise. */
export async function createPlanPaymentRequest(args: {
  profileId: string;
  requestedByUserId: string;
  plan: 'verificado' | 'destacado';
  bankAccountId?: string;
  reference?: string;
  proofDataUrl?: string;
}): Promise<string> {
  const prices = await getPlanPrices();
  const amountDop = args.plan === 'destacado' ? prices.destacado : prices.verificado;
  const [row] = await db
    .insert(planPayments)
    .values({
      profileId: args.profileId,
      requestedByUserId: args.requestedByUserId,
      plan: args.plan,
      amountDop: amountDop.toFixed(2),
      bankAccountId: args.bankAccountId,
      reference: args.reference?.trim() || null,
      proofDataUrl: args.proofDataUrl || null,
    })
    .returning({ id: planPayments.id });
  await notifyAdmins({
    type: 'plan.payment.pending',
    title: '💳 Nuevo pago de plan por revisar',
    body: `Plan ${args.plan} · ${amountDop.toFixed(0)} DOP`,
    url: '/admin/planes',
    meta: { planPaymentId: row!.id, profileId: args.profileId },
  });
  await audit(args.requestedByUserId, 'plan_payment.create', 'plan_payment', row!.id, { plan: args.plan, amountDop });
  return row!.id;
}

/**
 * Aprueba un pago: activa el plan (sumando al vencimiento si ya tenía uno vigente) y, para
 * Destacado, reserva el espacio dentro de una transacción que vuelve a contar los espacios
 * activos antes de insertar — así nunca se pasa del máximo aunque dos admins aprueben casi a
 * la vez.
 */
export async function approvePlanPayment(
  paymentId: string,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const result = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(planPayments).where(eq(planPayments.id, paymentId)).limit(1);
    if (!payment) return { ok: false, reason: 'Pago no encontrado' };
    if (payment.status !== 'pending') return { ok: false, reason: 'Este pago ya fue resuelto' };

    const [prof] = await tx
      .select({ id: profiles.id, ownerUserId: profiles.ownerUserId, categoryId: profiles.categoryId, province: profiles.province, planExpiresAt: profiles.planExpiresAt })
      .from(profiles)
      .where(eq(profiles.id, payment.profileId))
      .limit(1);
    if (!prof) return { ok: false, reason: 'Negocio no encontrado' };

    const scope = prof.province || 'todo-rd';

    if (payment.plan === 'destacado') {
      const activeNow = await tx
        .select({ id: featuredSlots.id })
        .from(featuredSlots)
        .where(and(eq(featuredSlots.categoryId, prof.categoryId), eq(featuredSlots.province, scope), gt(featuredSlots.endsAt, new Date())));
      if (activeNow.length >= MAX_FEATURED_PER_SCOPE) {
        return { ok: false, reason: 'Los 3 espacios de Destacado de esa categoría y zona ya están ocupados' };
      }
    }

    const base = prof.planExpiresAt && prof.planExpiresAt > new Date() ? prof.planExpiresAt : new Date();
    const newExpiresAt = new Date(base.getTime() + PLAN_DURATION_DAYS * 86_400_000);

    await tx
      .update(profiles)
      .set({ plan: payment.plan, planExpiresAt: newExpiresAt, planExpiryWarnedAt: null })
      .where(eq(profiles.id, prof.id));

    if (payment.plan === 'destacado') {
      await tx.insert(featuredSlots).values({
        profileId: prof.id,
        categoryId: prof.categoryId,
        province: scope,
        endsAt: newExpiresAt,
        planPaymentId: payment.id,
      });
    }

    await tx
      .update(planPayments)
      .set({ status: 'approved', approvedByUserId: adminUserId, approvedAt: new Date() })
      .where(eq(planPayments.id, paymentId));

    if (prof.ownerUserId) {
      await notifyUser(prof.ownerUserId, {
        type: 'plan.approved',
        title: `✅ Plan ${payment.plan} activado`,
        body: `Tu plan ${payment.plan} está activo hasta el ${newExpiresAt.toLocaleDateString('es-DO')}.`,
        url: `/p/${prof.id}`,
      });
    }
    await audit(adminUserId, 'plan_payment.approve', 'plan_payment', paymentId, { plan: payment.plan });
    return { ok: true as const };
  });

  if (result.ok) {
    const [approved] = await db
      .select({ requestedByUserId: planPayments.requestedByUserId })
      .from(planPayments)
      .where(eq(planPayments.id, paymentId))
      .limit(1);
    if (approved) await onPlanPaymentApproved(approved.requestedByUserId).catch(() => {});
  }
  return result;
}

export async function rejectPlanPayment(paymentId: string, adminUserId: string, reason: string): Promise<void> {
  const [payment] = await db
    .update(planPayments)
    .set({ status: 'rejected', approvedByUserId: adminUserId, approvedAt: new Date(), rejectionReason: reason || null })
    .where(eq(planPayments.id, paymentId))
    .returning();
  if (!payment) return;
  const [prof] = await db.select({ ownerUserId: profiles.ownerUserId }).from(profiles).where(eq(profiles.id, payment.profileId)).limit(1);
  if (prof?.ownerUserId) {
    await notifyUser(prof.ownerUserId, {
      type: 'plan.rejected',
      title: '❌ No pudimos confirmar tu pago',
      body: reason || 'Revisa el comprobante y vuelve a intentarlo.',
      url: `/p/${payment.profileId}`,
    });
  }
  await audit(adminUserId, 'plan_payment.reject', 'plan_payment', paymentId, { reason });
}

/**
 * Corre dentro del cron diario ya existente: avisa 3 días antes de vencer (una sola vez por
 * ciclo, gracias a `planExpiryWarnedAt`) y pasa a `free` los planes ya vencidos. Los espacios
 * Destacado no necesitan tocarse aparte — dejan de contar como activos solos en cuanto
 * `endsAt <= now()`.
 */
export async function processPlanExpirations(): Promise<{ warned: number; expired: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + WARN_BEFORE_DAYS * 86_400_000);

  const toWarn = await db
    .select({
      id: profiles.id,
      ownerUserId: profiles.ownerUserId,
      plan: profiles.plan,
      planExpiresAt: profiles.planExpiresAt,
      planExpiryWarnedAt: profiles.planExpiryWarnedAt,
    })
    .from(profiles)
    .where(and(gt(profiles.planExpiresAt, now), eq(profiles.isActive, true), ne(profiles.plan, 'free')));

  let warned = 0;
  for (const p of toWarn) {
    if (!p.planExpiresAt || p.planExpiresAt > soon) continue;
    if (p.planExpiryWarnedAt) continue; // ya se avisó en este ciclo
    if (!p.ownerUserId) continue;
    await db.update(profiles).set({ planExpiryWarnedAt: now }).where(eq(profiles.id, p.id));
    await notifyUser(p.ownerUserId, {
      type: 'plan.expiring_soon',
      title: '⏳ Tu plan vence pronto',
      body: `Tu plan ${p.plan} vence el ${p.planExpiresAt.toLocaleDateString('es-DO')}. Renuévalo para no perder tus beneficios.`,
      url: `/p/${p.id}`,
    });
    warned++;
  }

  const expiredRows = await db
    .update(profiles)
    .set({ plan: 'free', planExpiresAt: null, planExpiryWarnedAt: null })
    .where(and(ne(profiles.plan, 'free'), lt(profiles.planExpiresAt, now)))
    .returning({ id: profiles.id });

  return { warned, expired: expiredRows.length };
}
