import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, paypalOrders } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { createOrder, captureOrder } from '../lib/paypal';
import { dopToUsd } from '../../shared/fx';
import { audit } from '../lib/audit';

const r = Router();

r.post(
  '/paypal/create-order',
  requireAuth,
  ah(async (req, res) => {
    const { bidId } = z.object({ bidId: z.string().uuid() }).parse(req.body);

    const bid = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid[0]) throw new HttpError(404, 'Puja no encontrada');
    if (bid[0].userId !== req.user!.id) throw new HttpError(403, 'No autorizado');
    if (bid[0].status === 'verified') throw new HttpError(400, 'La puja ya está verificada');

    const usd =
      bid[0].currency === 'USD' ? Number(bid[0].amountOriginal) : dopToUsd(Number(bid[0].amountDop));

    const order = await createOrder(usd, bidId);
    await db.insert(paypalOrders).values({
      bidId,
      paypalOrderId: order.id,
      status: order.status,
      raw: order,
    });

    res.json({ orderId: order.id });
  }),
);

r.post(
  '/paypal/capture',
  requireAuth,
  ah(async (req, res) => {
    const { orderId } = z.object({ orderId: z.string().min(3) }).parse(req.body);

    const rec = await db.select().from(paypalOrders).where(eq(paypalOrders.paypalOrderId, orderId)).limit(1);
    if (!rec[0]) throw new HttpError(404, 'Orden de PayPal no encontrada');

    const capture = await captureOrder(orderId);
    const completed = capture.status === 'COMPLETED';
    const captureId: string | null =
      capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;

    await db
      .update(paypalOrders)
      .set({ status: capture.status, captureId, raw: capture })
      .where(eq(paypalOrders.id, rec[0].id));

    if (completed) {
      await db
        .update(bids)
        .set({
          status: 'verified',
          verifiedAt: new Date(),
          reference: `PayPal ${captureId ?? orderId}`,
        })
        .where(eq(bids.id, rec[0].bidId));
      await audit(req.user!.id, 'bid.verified.paypal', 'bid', rec[0].bidId, { orderId, captureId });
    }

    res.json({ status: capture.status, verified: completed });
  }),
);

export default r;
