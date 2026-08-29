import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { bids, profiles, dodoPayments } from '../../shared/schema';
import { verifyWebhook } from '../lib/dodo';
import { onBidVerified } from '../lib/rewards';
import { checkDethronements, notifyUser } from '../lib/notify';
import { audit } from '../lib/audit';
import { formatDOP } from '../../shared/fx';

const r = Router();

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

interface DodoEvent {
  type?: string;
  data?: {
    payment_id?: string;
    metadata?: Record<string, string>;
    payment?: { payment_id?: string; metadata?: Record<string, string> };
    checkout_session_id?: string;
  };
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
    if (event.type === 'payment.succeeded') {
      const d = event.data ?? {};
      const meta = d.metadata ?? d.payment?.metadata ?? {};
      const paymentId = d.payment_id ?? d.payment?.payment_id ?? null;

      let bidId: string | null = meta.bid_id ?? null;
      if (!bidId && (paymentId || d.checkout_session_id)) {
        const dp = await db
          .select({ bidId: dodoPayments.bidId })
          .from(dodoPayments)
          .where(
            paymentId
              ? eq(dodoPayments.paymentId, paymentId)
              : eq(dodoPayments.sessionId, d.checkout_session_id!),
          )
          .limit(1);
        bidId = dp[0]?.bidId ?? null;
      }

      if (bidId) {
        await db
          .update(dodoPayments)
          .set({ paymentId, status: 'succeeded', raw: event as object, updatedAt: new Date() })
          .where(eq(dodoPayments.bidId, bidId));

        const bid = (await db.select().from(bids).where(eq(bids.id, bidId)).limit(1))[0];

        if (bid && bid.status !== 'verified') {
          await db
            .update(bids)
            .set({
              status: 'verified',
              verifiedAt: new Date(),
              reference: `Dodo ${paymentId ?? ''}`.trim(),
            })
            .where(eq(bids.id, bid.id));

          await onBidVerified(bid.id);
          await checkDethronements(bid.profileId);

          const prof = (
            await db
              .select({ name: profiles.name })
              .from(profiles)
              .where(eq(profiles.id, bid.profileId))
              .limit(1)
          )[0];
          await notifyUser(bid.userId, {
            type: 'bid.verified',
            title: `✅ Puja verificada: ${formatDOP(Number(bid.amountDop))}`,
            body: `Tu pago con Dodo Payments se confirmó. Tu puja por ${prof?.name ?? 'el perfil'} ya cuenta en el ranking.`,
            url: `/p/${bid.profileId}`,
          });
          await audit(null, 'bid.verified.dodo', 'bid', bid.id, { paymentId });
        }
      } else {
        console.warn('[webhook/dodo] payment.succeeded sin bid_id resoluble', { paymentId });
      }
    } else if (event.type === 'payment.failed' || event.type === 'payment.cancelled') {
      const meta = event.data?.metadata ?? event.data?.payment?.metadata ?? {};
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
