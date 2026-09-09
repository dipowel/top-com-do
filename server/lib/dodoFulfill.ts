import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { bids, dodoPayments } from '../../shared/schema';
import { listRecentPayments, dodoAmountToDop } from './dodo';
import { creditVerifiedBid } from './fulfillBid';

/**
 * Acredita una puja pagada con Dodo. Idempotente: si ya está `verified` no hace nada.
 * Lo usan el webhook y la reconciliación.
 */
export async function fulfillBid(opts: {
  bidId: string;
  paymentId: string | null;
  paidDop: number | null;
  rawEvent?: unknown;
}): Promise<'verified' | 'already' | 'not_found'> {
  const bid = (await db.select({ id: bids.id }).from(bids).where(eq(bids.id, opts.bidId)).limit(1))[0];
  if (!bid) return 'not_found';

  // Registra siempre el pago en dodo_payments.
  await db
    .update(dodoPayments)
    .set({
      status: 'succeeded',
      updatedAt: new Date(),
      ...(opts.paymentId ? { paymentId: opts.paymentId } : {}),
      ...(opts.paidDop != null ? { amountDop: opts.paidDop.toFixed(2) } : {}),
      ...(opts.rawEvent !== undefined ? { raw: opts.rawEvent as object } : {}),
    })
    .where(eq(dodoPayments.bidId, opts.bidId));

  return creditVerifiedBid({
    bidId: opts.bidId,
    finalDop: opts.paidDop,
    reference: `Dodo ${opts.paymentId ?? ''}`.trim(),
    providerLabel: 'Dodo Payments',
  });
}

interface DodoPayment {
  payment_id?: string;
  status?: string;
  total_amount?: number;
  settlement_amount?: number;
  amount?: number;
  checkout_session_id?: string;
  metadata?: Record<string, string>;
}

function paymentsArray(body: unknown): DodoPayment[] {
  if (Array.isArray(body)) return body as DodoPayment[];
  const b = body as { items?: unknown; data?: unknown } | null;
  if (b && Array.isArray(b.items)) return b.items as DodoPayment[];
  if (b && Array.isArray(b.data)) return b.data as DodoPayment[];
  return [];
}

/**
 * Consulta a Dodo los pagos recientes y acredita las pujas `dodo` pendientes que
 * ya estén pagadas. No depende del webhook. `userId` la limita a un usuario.
 */
export async function reconcilePendingDodoBids(
  userId?: string,
): Promise<{ checked: number; fulfilled: string[] }> {
  const pending = await db
    .select({ bidId: bids.id, sessionId: dodoPayments.sessionId })
    .from(bids)
    .leftJoin(dodoPayments, eq(dodoPayments.bidId, bids.id))
    .where(
      and(
        eq(bids.method, 'dodo'),
        eq(bids.status, 'pending'),
        userId ? eq(bids.userId, userId) : undefined,
      ),
    );
  if (!pending.length) return { checked: 0, fulfilled: [] };

  const bySession = new Map<string, string>();
  for (const p of pending) if (p.sessionId) bySession.set(p.sessionId, p.bidId);
  const pendingIds = new Set(pending.map((p) => p.bidId));

  const payments = paymentsArray(await listRecentPayments(100));
  const fulfilled: string[] = [];

  for (const pay of payments) {
    if (pay.status && pay.status !== 'succeeded') continue;
    const bidId =
      pay.metadata?.bid_id ||
      (pay.checkout_session_id ? bySession.get(pay.checkout_session_id) : undefined);
    if (!bidId || !pendingIds.has(bidId)) continue;

    const centavos = pay.total_amount ?? pay.settlement_amount ?? pay.amount;
    const paidDop =
      typeof centavos === 'number' && Number.isFinite(centavos) ? dodoAmountToDop(centavos) : null;

    const r = await fulfillBid({
      bidId,
      paymentId: pay.payment_id ?? null,
      paidDop,
      rawEvent: pay,
    });
    if (r === 'verified') fulfilled.push(bidId);
    pendingIds.delete(bidId);
  }

  return { checked: pending.length, fulfilled };
}
