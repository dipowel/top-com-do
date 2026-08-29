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
import { createCheckout, dodoCheckoutReady } from '../lib/dodo';
import { minNextBidForProfile } from '../lib/auction';
import { formatDOP } from '../../shared/fx';

const r = Router();

const schema = z.object({
  profileId: z.string().uuid(),
  amountDop: z.number().positive().max(100_000_000),
});

/** Inicia una sesión de pago de Dodo Payments con el monto exacto de la oferta. */
r.post(
  '/dodo',
  requireAuth,
  ah(async (req, res) => {
    if (!dodoCheckoutReady()) {
      throw new HttpError(
        503,
        'Pagos no configurados: falta DODO_API_KEY en el servidor. Revisa /api/health/config.',
      );
    }
    const body = schema.parse(req.body);
    const amountDop = Math.round(body.amountDop * 100) / 100;

    const profile = await db
      .select({ id: profiles.id, isActive: profiles.isActive, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, body.profileId))
      .limit(1);
    if (!profile[0] || !profile[0].isActive) throw new HttpError(404, 'Perfil no encontrado');

    const { minBidDop } = await minNextBidForProfile(body.profileId);
    if (amountDop < minBidDop) {
      throw new HttpError(
        400,
        `Tu oferta debe superar al #1. Ofrece al menos ${formatDOP(minBidDop)}.`,
      );
    }

    const round = await getActiveRound();

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
        method: 'dodo',
        status: 'pending',
      })
      .returning();
    const bid = inserted[0]!;

    try {
      const checkout = await createCheckout({
        amountDop,
        bidId: bid.id,
        profileId: body.profileId,
        roundId: round.id,
        customerEmail: req.user!.email,
      });

      await db.insert(dodoPayments).values({
        bidId: bid.id,
        sessionId: checkout.sessionId || null,
        status: 'created',
        amountDop: amountDop.toFixed(2),
        raw: checkout.raw as object,
      });

      await audit(req.user!.id, 'bid.create', 'bid', bid.id, {
        method: 'dodo',
        amountDop,
        profileId: body.profileId,
      });

      res.status(201).json({ url: checkout.checkoutUrl, bidId: bid.id });
    } catch (err) {
      await db.delete(bids).where(eq(bids.id, bid.id));
      console.error('[checkout] Dodo falló:', (err as Error).message);
      throw new HttpError(502, 'No se pudo iniciar el pago con Dodo Payments. Intenta de nuevo.');
    }
  }),
);

export default r;
