import { Router } from 'express';
import { eq } from 'drizzle-orm';
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
import { checkDethronements } from '../lib/notify';
import { minNextBidForProfile } from '../lib/auction';
import { MIN_BID_DOP, BID_INCREMENT_DOP } from '../../shared/bidding';
import type { SuggestedBid } from '../../shared/types';

const r = Router();

/**
 * Estado de la subasta para orientar la oferta:
 *  - por perfil  → total del #1 de su ámbito, total propio y oferta mínima para superarlo
 *  - por categoría / provincia / general → total del #1 + incremento
 */
r.get(
  '/suggested',
  ah(async (req, res) => {
    const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const province = typeof req.query.province === 'string' ? req.query.province : undefined;

    if (profileId) {
      const s = await minNextBidForProfile(profileId);
      const payload: SuggestedBid = {
        minimum: MIN_BID_DOP,
        current: s.leaderTotalDop,
        myTotal: s.myTotalDop,
        next: s.minBidDop,
        scope: 'profile',
      };
      res.json(payload);
      return;
    }

    const ranking = await getRankings(category, province, 1);
    const current = ranking[0]?.totalDop ?? 0;
    const scope: SuggestedBid['scope'] =
      province && province !== 'todo-rd'
        ? 'province'
        : category && category !== 'todo-rd'
          ? 'category'
          : 'global';
    const next = Math.max(current + BID_INCREMENT_DOP, MIN_BID_DOP);
    const payload: SuggestedBid = { minimum: MIN_BID_DOP, current, next, scope };
    res.json(payload);
  }),
);

/**
 * Puja pagada con **saldo por referidos**. Los pagos con dinero real van por
 * `POST /api/checkout/dodo` (Dodo Payments). Aquí solo `credit`.
 */
const schema = z.object({
  profileId: z.string().uuid(),
  method: z.literal('credit'),
  amount: z.number().positive().max(100_000_000),
  currency: z.literal('DOP').default('DOP'),
});

r.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = schema.parse(req.body);

    const profile = await db.select().from(profiles).where(eq(profiles.id, body.profileId)).limit(1);
    if (!profile[0] || !profile[0].isActive) throw new HttpError(404, 'Perfil no encontrado');

    const round = await getActiveRound();
    const amountDop = Math.round(body.amount * 100) / 100;
    if (amountDop < MIN_BID_DOP) throw new HttpError(400, `El monto mínimo es RD$ ${MIN_BID_DOP}`);

    // Misma regla que Dodo: la oferta debe superar al #1 del ámbito.
    const { minBidDop } = await minNextBidForProfile(body.profileId);
    if (amountDop < minBidDop) {
      throw new HttpError(400, `Tu oferta debe superar al #1. Ofrece al menos RD$ ${minBidDop}.`);
    }

    const me = (await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1))[0]!;
    if (Number(me.creditBalanceDop) < amountDop) {
      throw new HttpError(400, 'Saldo insuficiente');
    }

    const inserted = await db
      .insert(bids)
      .values({
        profileId: body.profileId,
        userId: req.user!.id,
        roundId: round.id,
        amountDop: amountDop.toFixed(2),
        currency: 'DOP',
        amountOriginal: amountDop.toFixed(2),
        fxRate: '1.0000',
        method: 'credit',
        status: 'verified',
        verifiedAt: new Date(),
        reference: 'Pagado con saldo',
      })
      .returning();

    await moveCredit(
      req.user!.id,
      -amountDop,
      'bid_payment',
      inserted[0]!.id,
      `Puja pagada con saldo — ${profile[0].name}`,
    );
    await checkDethronements(body.profileId);

    await audit(req.user!.id, 'bid.create', 'bid', inserted[0]!.id, {
      amountDop,
      method: 'credit',
      profileId: body.profileId,
    });

    res.status(201).json({ bid: { ...inserted[0], amountDop: Number(inserted[0]!.amountDop) } });
  }),
);

export default r;
