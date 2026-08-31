import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { dodoPayments } from '../../shared/schema';
import { verifyWebhook, dodoAmountToDop } from '../lib/dodo';
import { fulfillBid } from '../lib/dodoFulfill';

const r = Router();

/** Ping de verificación del endpoint (Dodo hace un GET al registrar el webhook). */
r.get('/dodo', (_req, res) => res.json({ ok: true, endpoint: 'dodo-webhook' }));

/**
 * Cuerpo crudo del webhook. En Vercel lo bufferiza `api/index.ts` en `req.rawBody`;
 * en local el stream sigue disponible y se lee aquí. Nunca se usa el parser JSON
 * global (la firma se calcula sobre los bytes exactos).
 */
function readRawBody(req: Request): Promise<Buffer> {
  const pre = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (Buffer.isBuffer(pre)) return Promise.resolve(pre);
  if (Buffer.isBuffer((req as { body?: unknown }).body)) {
    return Promise.resolve((req as unknown as { body: Buffer }).body);
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

interface DodoData {
  payment_id?: string;
  status?: string;
  total_amount?: number;
  settlement_amount?: number;
  amount?: number;
  metadata?: Record<string, string>;
  checkout_session_id?: string;
  payment?: DodoData;
}
interface DodoEvent {
  type?: string;
  data?: DodoData;
}

r.post('/dodo', async (req, res) => {
  let event: DodoEvent;
  try {
    const raw = await readRawBody(req);
    event = verifyWebhook(raw, {
      id: req.headers['webhook-id'],
      timestamp: req.headers['webhook-timestamp'],
      signature: req.headers['webhook-signature'],
    }) as DodoEvent;
  } catch (err) {
    console.warn('[webhook/dodo] firma rechazada:', (err as Error).message);
    return res.status(401).json({ error: 'firma inválida' });
  }

  // A partir de aquí siempre respondemos 200 (Standard Webhooks reintenta ante no-2xx).
  try {
    const type = event.type ?? '';
    const d: DodoData = event.data ?? {};
    const p: DodoData = d.payment ?? d;
    const succeeded =
      type === 'payment.succeeded' ||
      (type.startsWith('payment.') && p.status === 'succeeded') ||
      type === 'checkout.session.completed';

    if (succeeded) {
      const meta = d.metadata ?? p.metadata ?? {};
      const paymentId = p.payment_id ?? d.payment_id ?? null;
      const sessionId = d.checkout_session_id ?? p.checkout_session_id ?? null;
      const centavos = p.total_amount ?? p.settlement_amount ?? p.amount ?? d.total_amount;
      const paidDop =
        typeof centavos === 'number' && Number.isFinite(centavos) ? dodoAmountToDop(centavos) : null;

      let bidId: string | null = meta.bid_id ?? null;
      if (!bidId && (paymentId || sessionId)) {
        const dp = await db
          .select({ bidId: dodoPayments.bidId })
          .from(dodoPayments)
          .where(paymentId ? eq(dodoPayments.paymentId, paymentId) : eq(dodoPayments.sessionId, sessionId!))
          .limit(1);
        bidId = dp[0]?.bidId ?? null;
      }

      if (bidId) {
        await fulfillBid({ bidId, paymentId, paidDop, rawEvent: event });
      } else {
        console.warn('[webhook/dodo] evento sin bid resoluble', { type, paymentId, sessionId });
      }
    } else if (type === 'payment.failed' || type === 'payment.cancelled') {
      const meta = (event.data?.metadata ?? event.data?.payment?.metadata) ?? {};
      if (meta.bid_id) {
        await db
          .update(dodoPayments)
          .set({ status: 'failed', raw: event as object, updatedAt: new Date() })
          .where(eq(dodoPayments.bidId, meta.bid_id));
      }
    }
  } catch (err) {
    console.error('[webhook/dodo] error procesando el evento:', (err as Error).message);
  }

  res.json({ received: true });
});

export default r;
