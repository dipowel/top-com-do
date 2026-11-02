import { eq } from 'drizzle-orm';
import { db } from '../db';
import { jobs, jobUrgentPayments } from '../../shared/schema';
import { getSetting } from './settings';
import { notifyUser, notifyAdmins } from './notify';
import { audit } from './audit';

const URGENT_DAYS = 7;

export async function getJobUrgentPrice(): Promise<number> {
  return Number(await getSetting('job_urgent_price_dop')) || 500;
}

export async function createJobUrgentRequest(args: {
  jobId: string;
  requestedByUserId: string;
  bankAccountId?: string;
  reference?: string;
  proofDataUrl?: string;
}): Promise<string> {
  const amountDop = await getJobUrgentPrice();
  const [row] = await db
    .insert(jobUrgentPayments)
    .values({
      jobId: args.jobId,
      requestedByUserId: args.requestedByUserId,
      amountDop: amountDop.toFixed(2),
      bankAccountId: args.bankAccountId,
      reference: args.reference?.trim() || null,
      proofDataUrl: args.proofDataUrl || null,
    })
    .returning({ id: jobUrgentPayments.id });
  await notifyAdmins({
    type: 'job_urgent.payment.pending',
    title: '🔥 Nueva vacante urgente por revisar',
    body: `${amountDop.toFixed(0)} DOP · 7 días`,
    url: '/admin/empleos',
    meta: { jobUrgentPaymentId: row!.id, jobId: args.jobId },
  });
  await audit(args.requestedByUserId, 'job_urgent_payment.create', 'job_urgent_payment', row!.id, { jobId: args.jobId, amountDop });
  return row!.id;
}

export async function approveJobUrgentPayment(
  paymentId: string,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [payment] = await db.select().from(jobUrgentPayments).where(eq(jobUrgentPayments.id, paymentId)).limit(1);
  if (!payment) return { ok: false, reason: 'Pago no encontrado' };
  if (payment.status !== 'pending') return { ok: false, reason: 'Este pago ya fue resuelto' };

  const urgentUntil = new Date(Date.now() + URGENT_DAYS * 86_400_000);
  await db.update(jobs).set({ urgentUntil }).where(eq(jobs.id, payment.jobId));
  await db
    .update(jobUrgentPayments)
    .set({ status: 'approved', approvedByUserId: adminUserId, approvedAt: new Date() })
    .where(eq(jobUrgentPayments.id, paymentId));

  await notifyUser(payment.requestedByUserId, {
    type: 'job_urgent.approved',
    title: '🔥 Tu vacante ya es urgente',
    body: `Se destaca como URGENTE hasta el ${urgentUntil.toLocaleDateString('es-DO')}.`,
    url: '/empleos/mis-vacantes',
  });
  await audit(adminUserId, 'job_urgent_payment.approve', 'job_urgent_payment', paymentId, { jobId: payment.jobId });
  return { ok: true };
}

export async function rejectJobUrgentPayment(paymentId: string, adminUserId: string, reason: string): Promise<void> {
  const [payment] = await db
    .update(jobUrgentPayments)
    .set({ status: 'rejected', approvedByUserId: adminUserId, approvedAt: new Date(), rejectionReason: reason || null })
    .where(eq(jobUrgentPayments.id, paymentId))
    .returning();
  if (!payment) return;
  await notifyUser(payment.requestedByUserId, {
    type: 'job_urgent.rejected',
    title: '❌ No pudimos confirmar tu pago',
    body: reason || 'Revisa el comprobante y vuelve a intentarlo.',
    url: '/empleos/mis-vacantes',
  });
  await audit(adminUserId, 'job_urgent_payment.reject', 'job_urgent_payment', paymentId, { reason });
}
