import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { profiles, bankAccounts, planPayments } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { getPlanPrices } from '../lib/settings';
import { featuredSlotsRemaining, createPlanPaymentRequest } from '../lib/plans';

const r = Router();

/** Público: precios vigentes + cuentas bancarias activas — para la pantalla de planes. */
r.get(
  '/prices',
  ah(async (_req, res) => {
    const prices = await getPlanPrices();
    const accounts = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.isActive, true))
      .orderBy(bankAccounts.sortOrder);
    res.json({ prices, bankAccounts: accounts });
  }),
);

const requestSchema = z.object({
  plan: z.enum(['verificado', 'destacado']),
  bankAccountId: z.string().uuid().optional(),
  reference: z.string().max(80).optional(),
  proofDataUrl: z.string().max(2_800_000).optional(),
});

/** El dueño del negocio sube su comprobante de transferencia — queda pendiente de revisión. */
r.post(
  '/:profileId/request',
  requireAuth,
  ah(async (req, res) => {
    const body = requestSchema.parse(req.body);
    const [prof] = await db
      .select({ id: profiles.id, ownerUserId: profiles.ownerUserId })
      .from(profiles)
      .where(and(eq(profiles.id, req.params.profileId), eq(profiles.isActive, true)))
      .limit(1);
    if (!prof) throw new HttpError(404, 'Negocio no encontrado');
    if (prof.ownerUserId !== req.user!.id && req.user!.role === 'user') {
      throw new HttpError(403, 'Solo el dueño del negocio puede pedir un plan');
    }

    const id = await createPlanPaymentRequest({
      profileId: prof.id,
      requestedByUserId: req.user!.id,
      plan: body.plan,
      bankAccountId: body.bankAccountId,
      reference: body.reference,
      proofDataUrl: body.proofDataUrl,
    });
    res.status(201).json({ ok: true, id });
  }),
);

/** El dueño (o admin) ve el plan actual del negocio + su último pago. */
r.get(
  '/:profileId/status',
  requireAuth,
  ah(async (req, res) => {
    const [prof] = await db
      .select({
        id: profiles.id,
        ownerUserId: profiles.ownerUserId,
        plan: profiles.plan,
        planExpiresAt: profiles.planExpiresAt,
        isVerified: profiles.isVerified,
        categoryId: profiles.categoryId,
        province: profiles.province,
      })
      .from(profiles)
      .where(eq(profiles.id, req.params.profileId))
      .limit(1);
    if (!prof) throw new HttpError(404, 'Negocio no encontrado');
    if (prof.ownerUserId !== req.user!.id && req.user!.role === 'user') {
      throw new HttpError(403, 'No autorizado');
    }

    const [lastPayment] = await db
      .select()
      .from(planPayments)
      .where(eq(planPayments.profileId, prof.id))
      .orderBy(desc(planPayments.createdAt))
      .limit(1);

    const featuredRemaining = await featuredSlotsRemaining(prof.categoryId, prof.province || 'todo-rd');

    res.json({
      plan: prof.plan,
      planExpiresAt: prof.planExpiresAt,
      isVerified: prof.isVerified,
      featuredRemaining,
      lastPayment: lastPayment
        ? {
            id: lastPayment.id,
            plan: lastPayment.plan,
            amountDop: Number(lastPayment.amountDop),
            status: lastPayment.status,
            createdAt: lastPayment.createdAt,
            rejectionReason: lastPayment.rejectionReason,
          }
        : null,
    });
  }),
);

export default r;
