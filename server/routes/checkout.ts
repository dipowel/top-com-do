import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, profiles, azulPayments } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { getActiveRound } from '../lib/rounds';
import { audit } from '../lib/audit';
import { minNextBidForProfile } from '../lib/auction';
import { formatDOP } from '../../shared/fx';
import { azulConfigured, buildAzulSaleForm, newAzulOrderNumber } from '../lib/azul';

const r = Router();

const schema = z.object({
  profileId: z.string().uuid(),
  amountDop: z.number().positive().max(100_000_000),
});

/** Valida perfil + monto y crea la puja `pending`. */
async function openBidForCheckout(
  userId: string,
  body: z.infer<typeof schema>,
): Promise<{ bidId: string; amountDop: number; profileName: string; roundId: string }> {
  const amountDop = Math.round(body.amountDop * 100) / 100;
  const [profile] = await db
    .select({ id: profiles.id, isActive: profiles.isActive, name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, body.profileId))
    .limit(1);
  if (!profile || !profile.isActive) throw new HttpError(404, 'Perfil no encontrado');

  const { minBidDop } = await minNextBidForProfile(body.profileId);
  if (amountDop < minBidDop) {
    throw new HttpError(400, `Tu oferta debe superar al #1. Ofrece al menos ${formatDOP(minBidDop)}.`);
  }
  const round = await getActiveRound();
  const [bid] = await db
    .insert(bids)
    .values({
      profileId: body.profileId,
      userId,
      roundId: round.id,
      amountDop: amountDop.toFixed(2),
      currency: 'DOP',
      amountOriginal: amountDop.toFixed(2),
      fxRate: '1.0000',
      method: 'azul',
      status: 'pending',
    })
    .returning();
  return { bidId: bid!.id, amountDop, profileName: profile.name, roundId: round.id };
}

/** Inicia el pago de una puja: el navegador hace el POST al Payment Page de AZUL. */
r.post(
  '/azul',
  requireAuth,
  ah(async (req, res) => {
    const body = schema.parse(req.body);

    if (!azulConfigured()) {
      throw new HttpError(
        503,
        'Pagos AZUL aún no configurados: falta AZUL_MERCHANT_ID / AZUL_AUTH_KEY en el servidor.',
      );
    }
    const opened = await openBidForCheckout(req.user!.id, body);

    // OrderNumber único (reintenta si choca con el índice).
    let orderNumber = newAzulOrderNumber();
    for (let i = 0; i < 5; i++) {
      const [dup] = await db
        .select({ id: azulPayments.id })
        .from(azulPayments)
        .where(eq(azulPayments.orderNumber, orderNumber))
        .limit(1);
      if (!dup) break;
      orderNumber = newAzulOrderNumber();
    }

    const form = buildAzulSaleForm({
      orderNumber,
      amountDop: opened.amountDop,
      concept: `Puja #1 - ${opened.profileName}`,
    });

    await db.insert(azulPayments).values({
      bidId: opened.bidId,
      orderNumber,
      amount: Math.round(opened.amountDop * 100),
      itbis: Number(form.fields.ITBIS) || 0,
      currencyCode: form.fields.CurrencyCode,
      status: 'created',
    });
    await audit(req.user!.id, 'bid.create', 'bid', opened.bidId, {
      method: 'azul',
      amountDop: opened.amountDop,
      order: orderNumber,
    });

    res.status(201).json({
      kind: 'form',
      actionUrl: form.actionUrl,
      actionUrlAlt: form.actionUrlAlt,
      fields: form.fields,
      bidId: opened.bidId,
    });
  }),
);

export default r;
