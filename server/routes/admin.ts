import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, profiles, users, auditLog, referrals, reviews } from '../../shared/schema';
import { alias } from 'drizzle-orm/pg-core';
import { ah } from '../lib/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { resetRound, getActiveRound } from '../lib/rounds';
import { getRankings } from '../lib/rankings';
import { audit } from '../lib/audit';
import { onBidVerified, approveReferral, rejectReferral, moveCredit } from '../lib/rewards';
import { checkDethronements, notifyUser } from '../lib/notify';
import { formatDOP } from '../../shared/fx';

const r = Router();
r.use(requireAdmin);

r.get(
  '/overview',
  ah(async (_req, res) => {
    const round = await getActiveRound();
    const pending = await db
      .select({ n: sql<string>`count(*)` })
      .from(bids)
      .where(eq(bids.status, 'pending'));
    const verified = await db
      .select({ s: sql<string>`coalesce(sum(${bids.amountDop}),0)` })
      .from(bids)
      .where(and(eq(bids.status, 'verified'), eq(bids.roundId, round.id)));
    const refs = await db
      .select({ n: sql<string>`count(*)` })
      .from(referrals)
      .where(eq(referrals.status, 'eligible'));
    const flaggedReviews = await db
      .select({ n: sql<string>`count(*)` })
      .from(reviews)
      .where(eq(reviews.status, 'flagged'));
    res.json({
      round,
      pendingCount: Number(pending[0]?.n ?? 0),
      verifiedTotal: Number(verified[0]?.s ?? 0),
      eligibleReferrals: Number(refs[0]?.n ?? 0),
      flaggedReviews: Number(flaggedReviews[0]?.n ?? 0),
    });
  }),
);

r.get(
  '/bids',
  ah(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await db
      .select({
        id: bids.id,
        amountDop: bids.amountDop,
        currency: bids.currency,
        amountOriginal: bids.amountOriginal,
        method: bids.method,
        status: bids.status,
        reference: bids.reference,
        notes: bids.notes,
        createdAt: bids.createdAt,
        verifiedAt: bids.verifiedAt,
        profileName: profiles.name,
        profileHandle: profiles.handle,
        bidderEmail: users.email,
        bidderName: users.displayName,
      })
      .from(bids)
      .innerJoin(profiles, eq(profiles.id, bids.profileId))
      .innerJoin(users, eq(users.id, bids.userId))
      .where(status ? eq(bids.status, status as 'pending' | 'verified' | 'rejected') : undefined)
      .orderBy(desc(bids.createdAt))
      .limit(500);
    res.json(
      rows.map((x) => ({ ...x, amountDop: Number(x.amountDop), amountOriginal: Number(x.amountOriginal) })),
    );
  }),
);

/**
 * Cola de pagos por revisar: TODAS las pujas por transferencia en un estado
 * (por defecto `pending`), tengan o no comprobante subido. El admin ve el
 * número de confirmación y/o el comprobante y aprueba o rechaza.
 */
r.post(
  '/bids/:id/verify',
  ah(async (req, res) => {
    const { status, notes } = z
      .object({ status: z.enum(['verified', 'rejected']), notes: z.string().max(500).optional() })
      .parse(req.body);

    const bid = await db.select().from(bids).where(eq(bids.id, req.params.id)).limit(1);
    if (!bid[0]) throw new HttpError(404, 'Puja no encontrada');

    const updated = await db
      .update(bids)
      .set({
        status,
        notes,
        verifiedAt: status === 'verified' ? new Date() : null,
        verifiedByUserId: req.user!.id,
      })
      .where(eq(bids.id, req.params.id))
      .returning();

    const prof = (
      await db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, bid[0].profileId)).limit(1)
    )[0];

    if (status === 'verified') {
      // Referido → "elegible" (no acredita: el admin lo libera aparte).
      await onBidVerified(req.params.id);
      // Recalcula el #1 de cada ámbito y avisa a quien haya sido destronado.
      await checkDethronements(bid[0].profileId);
      await notifyUser(bid[0].userId, {
        type: 'bid.verified',
        title: `✅ Puja verificada: ${formatDOP(Number(bid[0].amountDop))}`,
        body: `Tu puja por ${prof?.name ?? 'el perfil'} ya cuenta en el ranking.`,
        url: `/p/${bid[0].profileId}`,
      });
    } else {
      await notifyUser(bid[0].userId, {
        type: 'bid.rejected',
        title: '❌ Puja rechazada',
        body: `Tu puja por ${prof?.name ?? 'el perfil'} fue rechazada${notes ? `: ${notes}` : ''}.`,
        url: '/mis-pujas',
      });
    }

    await audit(req.user!.id, `bid.${status}`, 'bid', req.params.id, { notes });
    res.json({ bid: { ...updated[0], amountDop: Number(updated[0]!.amountDop) } });
  }),
);

// ---------------- Referidos ----------------
r.get(
  '/referrals',
  ah(async (_req, res) => {
    const referrer = alias(users, 'referrer');
    const referred = alias(users, 'referred');
    const rows = await db
      .select({
        id: referrals.id,
        status: referrals.status,
        bonusDop: referrals.bonusDop,
        createdAt: referrals.createdAt,
        approvedAt: referrals.approvedAt,
        referrerEmail: referrer.email,
        referrerName: referrer.displayName,
        referredEmail: referred.email,
        referredName: referred.displayName,
        verifiedBids: sql<string>`(
          select count(*) from ${bids}
          where ${bids.userId} = ${referrals.referredUserId}
          and ${bids.status} = 'verified'
          and ${bids.amountDop} >= 100
        )`,
      })
      .from(referrals)
      .leftJoin(referrer, eq(referrer.id, referrals.referrerUserId))
      .leftJoin(referred, eq(referred.id, referrals.referredUserId))
      .orderBy(desc(referrals.createdAt));
    res.json(
      rows.map((x) => ({ ...x, bonusDop: Number(x.bonusDop), verifiedBids: Number(x.verifiedBids) })),
    );
  }),
);

r.post(
  '/referrals/:id/approve',
  ah(async (req, res) => {
    await approveReferral(req.params.id, req.user!.id).catch((e) => {
      throw new HttpError(400, (e as Error).message);
    });
    res.json({ ok: true });
  }),
);

r.post(
  '/referrals/:id/reject',
  ah(async (req, res) => {
    await rejectReferral(req.params.id, req.user!.id);
    res.json({ ok: true });
  }),
);

/** Ajuste manual de saldo de un usuario (por email). */
r.post(
  '/credit-adjust',
  ah(async (req, res) => {
    const { email, amountDop, note } = z
      .object({ email: z.string().email(), amountDop: z.number(), note: z.string().max(200).optional() })
      .parse(req.body);
    const u = (await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1))[0];
    if (!u) throw new HttpError(404, 'Usuario no encontrado');
    await moveCredit(u.id, amountDop, 'admin_adjust', null, note || 'Ajuste manual del admin');
    await audit(req.user!.id, 'credit.adjust', 'user', u.id, { amountDop, note });
    res.json({ ok: true });
  }),
);

r.post(
  '/rounds/reset',
  ah(async (req, res) => {
    const previous = await getRankings('todo-rd', undefined, 1);
    const round = await resetRound(req.user!.id);
    await audit(req.user!.id, 'round.reset', 'round', round.id, {
      previousChampion: previous[0]?.profile.handle ?? null,
    });
    res.json({ round, previousChampion: previous[0] ?? null });
  }),
);

// ---------------- Moderación de reseñas ----------------
r.get(
  '/reviews',
  ah(async (req, res) => {
    const status = (typeof req.query.status === 'string' ? req.query.status : 'flagged') as
      | 'published'
      | 'flagged'
      | 'hidden';
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        createdAt: reviews.createdAt,
        ipHash: reviews.ipHash,
        profileId: reviews.profileId,
        profileName: profiles.name,
        authorEmail: users.email,
        authorName: users.displayName,
      })
      .from(reviews)
      .innerJoin(profiles, eq(profiles.id, reviews.profileId))
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(eq(reviews.status, status))
      .orderBy(desc(reviews.createdAt))
      .limit(200);
    res.json(rows);
  }),
);

r.post(
  '/reviews/:id/status',
  ah(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['published', 'hidden', 'flagged']) })
      .parse(req.body);
    const updated = await db
      .update(reviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(reviews.id, req.params.id))
      .returning();
    if (!updated[0]) throw new HttpError(404, 'Reseña no encontrada');
    await audit(req.user!.id, `review.${status}`, 'review', req.params.id, {});
    res.json({ ok: true });
  }),
);

r.get(
  '/audit-log',
  ah(async (_req, res) => {
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        meta: auditLog.meta,
        createdAt: auditLog.createdAt,
        actorEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .orderBy(desc(auditLog.createdAt))
      .limit(300);
    res.json(rows);
  }),
);

export default r;
