import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, profiles, dodoPayments, azulPayments } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { getActiveRound } from '../lib/rounds';
import { audit } from '../lib/audit';
import { createCheckout, dodoCheckoutReady } from '../lib/dodo';
import { reconcilePendingDodoBids } from '../lib/dodoFulfill';
import { minNextBidForProfile } from '../lib/auction';
import { formatDOP } from '../../shared/fx';
import { azulConfigured, buildAzulSaleForm, newAzulOrderNumber } from '../lib/azul';

const r = Router();

const schema = z.object({
  profileId: z.string().uuid(),
  amountDop: z.number().positive().max(100_000_000),
});

/** Provider activo: 'azul' por defecto; 'dodo' para rollback sin tocar código. */
const paymentProvider = (): 'azul' | 'dodo' =>
  (process.env.PAYMENT_PROVIDER || 'azul').toLowerCase() === 'dodo' ? 'dodo' : 'azul';

/** Valida perfil + monto y crea la puja `pending`. Compartido por las pasarelas. */
async function openBidForCheckout(
  userId: string,
  body: z.infer<typeof schema>,
  method: 'azul' | 'dodo',
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
      method,
      status: 'pending',
    })
    .returning();
  return { bidId: bid!.id, amountDop, profileName: profile.name, roundId: round.id };
}

/**
 * Inicia el pago de una puja. Devuelve `{ kind: 'form', ... }` para AZUL (el
 * navegador hace el POST al Payment Page) o `{ kind: 'redirect', url }` para Dodo.
 */
r.post(
  '/azul',
  requireAuth,
  ah(async (req, res) => {
    const body = schema.parse(req.body);
    const provider = paymentProvider();

    if (provider === 'dodo') {
      if (!dodoCheckoutReady()) throw new HttpError(503, 'Pagos no configurados (Dodo).');
      const opened = await openBidForCheckout(req.user!.id, body, 'dodo');
      try {
        const checkout = await createCheckout({
          amountDop: opened.amountDop,
          bidId: opened.bidId,
          profileId: body.profileId,
          roundId: opened.roundId,
          customerEmail: req.user!.email,
        });
        await db.insert(dodoPayments).values({
          bidId: opened.bidId,
          sessionId: checkout.sessionId || null,
          status: 'created',
          amountDop: opened.amountDop.toFixed(2),
          raw: checkout.raw as object,
        });
        await audit(req.user!.id, 'bid.create', 'bid', opened.bidId, { method: 'dodo', amountDop: opened.amountDop });
        res.status(201).json({ kind: 'redirect', url: checkout.checkoutUrl, bidId: opened.bidId });
      } catch (err) {
        await db.delete(bids).where(eq(bids.id, opened.bidId));
        throw new HttpError(502, `No se pudo iniciar el pago — ${(err as Error).message}`);
      }
      return;
    }

    if (!azulConfigured()) {
      throw new HttpError(
        503,
        'Pagos AZUL aún no configurados: falta AZUL_MERCHANT_ID / AZUL_AUTH_KEY en el servidor.',
      );
    }
    const opened = await openBidForCheckout(req.user!.id, body, 'azul');

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
      const detail = (err as Error).message;
      console.error('[checkout] pasarela falló:', detail);
      throw new HttpError(502, `No se pudo iniciar el pago con AZUL — ${detail}`);
    }
  }),
);

/**
 * Reconciliación manual del admin: pregunta a Dodo por los pagos recientes y
 * acredita las pujas `dodo` pendientes que ya estén pagadas (no depende del webhook).
 */
r.post(
  '/dodo/reconcile',
  requireAdmin,
  ah(async (_req, res) => {
    const result = await reconcilePendingDodoBids();
    res.json(result);
  }),
);

/**
 * El usuario vuelve del checkout: reconcilia solo sus pujas y devuelve el conteo.
 * Lo llama `/mis-pujas?pago=procesando`.
 */
r.get(
  '/dodo/status',
  requireAuth,
  ah(async (req, res) => {
    await reconcilePendingDodoBids(req.user!.id).catch(() => null);
    const rows = await db
      .select({ status: bids.status, n: sql<string>`count(*)` })
      .from(bids)
      .where(and(eq(bids.userId, req.user!.id), eq(bids.method, 'dodo')))
      .groupBy(bids.status);
    const by = Object.fromEntries(rows.map((x) => [x.status, Number(x.n)]));
    res.json({ pending: by.pending ?? 0, verified: by.verified ?? 0, rejected: by.rejected ?? 0 });
  }),
);

export default r;
