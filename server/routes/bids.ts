import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, profiles, users } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { getActiveRound } from '../lib/rounds';
import { getRankings } from '../lib/rankings';
import { audit } from '../lib/audit';
import { moveCredit } from '../lib/rewards';
import { FX_USD_DOP, usdToDop } from '../../shared/fx';
import type { SuggestedBid } from '../../shared/types';

const r = Router();

const MIN_BID_DOP = 100;
const STEP_DOP = 100;

/**
 * Monto sugerido para pujar:
 *  - por perfil  → total verificado de ese perfil + 100
 *  - por categoría → total del #1 de esa categoría + 100
 *  - general → total del #1 general + 100
 */
r.get(
  '/suggested',
  ah(async (req, res) => {
    const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    let current = 0;
    let scope: SuggestedBid['scope'] = 'global';

    if (profileId) {
      const round = await getActiveRound();
      const rows = await db
        .select({ total: sql<string>`coalesce(sum(${bids.amountDop}),0)` })
        .from(bids)
        .where(
          and(eq(bids.profileId, profileId), eq(bids.roundId, round.id), eq(bids.status, 'verified')),
        );
      current = Number(rows[0]?.total ?? 0);
      scope = 'profile';
    } else {
      const ranking = await getRankings(category, 1);
      current = ranking[0]?.totalDop ?? 0;
      scope = category && category !== 'todo-rd' ? 'category' : 'global';
    }

    const next = Math.max(current + STEP_DOP, MIN_BID_DOP);
    const payload: SuggestedBid = { minimum: MIN_BID_DOP, current, next, scope };
    res.json(payload);
  }),
);

const schema = z.object({
  profileId: z.string().uuid(),
  method: z.enum(['bank_transfer', 'paypal', 'credit']),
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
    if (body.method === 'credit' && body.currency !== 'DOP') {
      throw new HttpError(400, 'El saldo se usa en RD$');
    }

    const profile = await db.select().from(profiles).where(eq(profiles.id, body.profileId)).limit(1);
    if (!profile[0] || !profile[0].isActive) throw new HttpError(404, 'Perfil no encontrado');

    const round = await getActiveRound();
    const amountDop = body.currency === 'USD' ? usdToDop(body.amount) : body.amount;
    if (amountDop < MIN_BID_DOP) throw new HttpError(400, `El monto mínimo es RD$ ${MIN_BID_DOP}`);

    // Pago con saldo de referidos → se descuenta al instante y la puja queda verificada.
    if (body.method === 'credit') {
      const me = (await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1))[0]!;
      if (Number(me.creditBalanceDop) < amountDop) {
        throw new HttpError(400, 'Saldo insuficiente');
      }
    }

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
        status: body.method === 'credit' ? 'verified' : 'pending',
        verifiedAt: body.method === 'credit' ? new Date() : null,
        reference: body.method === 'credit' ? 'Pagado con saldo' : body.reference,
      })
      .returning();

    if (body.method === 'credit') {
      await moveCredit(
        req.user!.id,
        -amountDop,
        'bid_payment',
        inserted[0]!.id,
        `Puja pagada con saldo — ${profile[0].name}`,
      );
    }

    await audit(req.user!.id, 'bid.create', 'bid', inserted[0]!.id, {
      amountDop,
      method: body.method,
      profileId: body.profileId,
    });

    res.status(201).json({ bid: { ...inserted[0], amountDop: Number(inserted[0]!.amountDop) } });
  }),
);

/** Guarda el número de confirmación de una transferencia (lo pega el usuario). */
r.post(
  '/:id/confirmation',
  requireAuth,
  ah(async (req, res) => {
    const { reference } = z.object({ reference: z.string().min(3).max(120) }).parse(req.body);
    const bid = await db.select().from(bids).where(eq(bids.id, req.params.id)).limit(1);
    if (!bid[0]) throw new HttpError(404, 'Puja no encontrada');
    if (bid[0].userId !== req.user!.id && req.user!.role === 'user') {
      throw new HttpError(403, 'No autorizado');
    }
    const updated = await db
      .update(bids)
      .set({ reference: reference.trim() })
      .where(eq(bids.id, req.params.id))
      .returning();
    await audit(req.user!.id, 'bid.confirmation', 'bid', req.params.id, { reference });
    res.json({ bid: { ...updated[0], amountDop: Number(updated[0]!.amountDop) } });
  }),
);

export default r;
