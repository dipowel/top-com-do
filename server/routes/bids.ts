import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, profiles } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { getActiveRound } from '../lib/rounds';
import { audit } from '../lib/audit';
import { FX_USD_DOP, usdToDop } from '../../shared/fx';

const r = Router();

const schema = z.object({
  profileId: z.string().uuid(),
  method: z.enum(['bank_transfer', 'paypal']),
  amount: z.number().positive().max(100_000_000),
  currency: z.enum(['DOP', 'USD']).default('DOP'),
  reference: z.string().max(120).optional(),
});

r.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = schema.parse(req.body);
    if (body.method === 'paypal' && body.currency !== 'USD') {
      throw new HttpError(400, 'Los pagos por PayPal se cobran en USD');
    }

    const profile = await db.select().from(profiles).where(eq(profiles.id, body.profileId)).limit(1);
    if (!profile[0] || !profile[0].isActive) throw new HttpError(404, 'Perfil no encontrado');

    const round = await getActiveRound();
    const amountDop = body.currency === 'USD' ? usdToDop(body.amount) : body.amount;
    if (amountDop <= 0) throw new HttpError(400, 'El monto debe ser mayor a 0');

    const inserted = await db
      .insert(bids)
      .values({
        profileId: body.profileId,
        userId: req.user!.id,
        roundId: round.id,
        amountDop: amountDop.toFixed(2),
        currency: body.currency,
        amountOriginal: body.amount.toFixed(2),
        fxRate: (body.currency === 'USD' ? FX_USD_DOP : 1).toFixed(4),
        method: body.method,
        status: 'pending',
        reference: body.reference,
      })
      .returning();

    await audit(req.user!.id, 'bid.create', 'bid', inserted[0]!.id, {
      amountDop,
      method: body.method,
      profileId: body.profileId,
    });

    res.status(201).json({ bid: { ...inserted[0], amountDop: Number(inserted[0]!.amountDop) } });
  }),
);

export default r;
