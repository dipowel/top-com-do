import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, profiles, dodoPayments } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { getActiveRound } from '../lib/rounds';
import { audit } from '../lib/audit';
import { createCheckout, dodoConfigured } from '../lib/dodo';
import { BID_TIERS_DOP } from '../../shared/bidding';

const r = Router();

const schema = z.object({
  profileId: z.string().uuid(),
  tier: z.union([z.literal(500), z.literal(1000), z.literal(2500), z.literal(5000)]),
});

/** Inicia una sesión de pago de Dodo Payments para una puja de nivel fijo. */
r.post(
  '/dodo',
  requireAuth,
  ah(async (req, res) => {
    if (!dodoConfigured()) {
      throw new HttpError(503, 'Los pagos no están configurados. Contacta al administrador.');
    }
    const body = schema.parse(req.body);
    if (!(BID_TIERS_DOP as readonly number[]).includes(body.tier)) {
      throw new HttpError(400, 'Nivel de puja inválido');
    }

    const profile = await db
      .select({ id: profiles.id, isActive: profiles.isActive, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, body.profileId))
      .limit(1);
    if (!profile[0] || !profile[0].isActive) throw new HttpError(404, 'Perfil no encontrado');

    const round = await getActiveRound();

    const inserted = await db
      .insert(bids)
      .values({
        profileId: body.profileId,
        userId: req.user!.id,
        roundId: round.id,
        amountDop: body.tier.toFixed(2),
        currency: 'DOP',
        amountOriginal: body.tier.toFixed(2),
        fxRate: '1.0000',
        method: 'dodo',
        status: 'pending',
      })
      .returning();
    const bid = inserted[0]!;

    try {
      const checkout = await createCheckout({
        tier: body.tier,
        bidId: bid.id,
        profileId: body.profileId,
        roundId: round.id,
        customerEmail: req.user!.email,
      });

      await db.insert(dodoPayments).values({
        bidId: bid.id,
        sessionId: checkout.sessionId || null,
        status: 'created',
        tierDop: body.tier,
        raw: checkout.raw as object,
      });

      await audit(req.user!.id, 'bid.create', 'bid', bid.id, {
        method: 'dodo',
        tier: body.tier,
        profileId: body.profileId,
      });

      res.status(201).json({ url: checkout.checkoutUrl, bidId: bid.id });
    } catch (err) {
      // Limpia la puja pendiente que quedó huérfana si Dodo no respondió.
      await db.delete(bids).where(eq(bids.id, bid.id));
      console.error('[checkout] Dodo falló:', (err as Error).message);
      throw new HttpError(502, 'No se pudo iniciar el pago con Dodo Payments. Intenta de nuevo.');
    }
  }),
);

export default r;
