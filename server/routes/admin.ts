import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  bids,
  profiles,
  users,
  paymentReceipts,
  bankAccounts,
  auditLog,
  referrals,
} from '../../shared/schema';
import { alias } from 'drizzle-orm/pg-core';
import { ah } from '../lib/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { resetRound, getActiveRound } from '../lib/rounds';
import { getRankings } from '../lib/rankings';
import { audit } from '../lib/audit';
import { onBidVerified, approveReferral, rejectReferral, moveCredit } from '../lib/rewards';

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
    res.json({
      round,
      pendingCount: Number(pending[0]?.n ?? 0),
      verifiedTotal: Number(verified[0]?.s ?? 0),
      eligibleReferrals: Number(refs[0]?.n ?? 0),
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
        receiptUrl: paymentReceipts.fileUrl,
        receiptMime: paymentReceipts.fileMime,
      })
      .from(bids)
      .innerJoin(profiles, eq(profiles.id, bids.profileId))
      .innerJoin(users, eq(users.id, bids.userId))
      .leftJoin(paymentReceipts, eq(paymentReceipts.bidId, bids.id))
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
r.get(
  '/receipts',
  ah(async (req, res) => {
    const status = (typeof req.query.status === 'string' ? req.query.status : 'pending') as
      | 'pending'
      | 'verified'
      | 'rejected';
    const rows = await db
      .select({
        bidId: bids.id,
        amountDop: bids.amountDop,
        method: bids.method,
        status: bids.status,
        reference: bids.reference,
        notes: bids.notes,
        createdAt: bids.createdAt,
        profileName: profiles.name,
        bidderEmail: users.email,
        bidderName: users.displayName,
        receiptUrl: paymentReceipts.fileUrl,
        receiptMime: paymentReceipts.fileMime,
        uploadedAt: paymentReceipts.uploadedAt,
      })
      .from(bids)
      .innerJoin(profiles, eq(profiles.id, bids.profileId))
      .innerJoin(users, eq(users.id, bids.userId))
      .leftJoin(paymentReceipts, eq(paymentReceipts.bidId, bids.id))
      .where(and(eq(bids.status, status), eq(bids.method, 'bank_transfer')))
      .orderBy(desc(bids.createdAt));
    res.json(rows.map((x) => ({ ...x, amountDop: Number(x.amountDop) })));
  }),
);

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

    // Si se verifica y el que puja fue referido, marca el referido como "elegible"
    // (NO acredita nada: el admin debe aprobarlo aparte en la pestaña Referidos).
    if (status === 'verified') {
      await onBidVerified(req.params.id);
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

const accountSchema = z.object({
  bankName: z.string().min(2),
  accountHolder: z.string().min(2),
  accountNumber: z.string().min(3),
  accountType: z.string().optional().nullable(),
  currency: z.enum(['DOP', 'USD']).default('DOP'),
  instructions: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

r.get(
  '/bank-accounts',
  ah(async (_req, res) => {
    res.json(await db.select().from(bankAccounts).orderBy(bankAccounts.sortOrder));
  }),
);

r.post(
  '/bank-accounts',
  ah(async (req, res) => {
    const body = accountSchema.parse(req.body);
    const inserted = await db.insert(bankAccounts).values(body).returning();
    await audit(req.user!.id, 'bank_account.create', 'bank_account', inserted[0]!.id, body);
    res.status(201).json(inserted[0]);
  }),
);

r.put(
  '/bank-accounts/:id',
  ah(async (req, res) => {
    const body = accountSchema.partial().parse(req.body);
    const updated = await db
      .update(bankAccounts)
      .set(body)
      .where(eq(bankAccounts.id, req.params.id))
      .returning();
    if (!updated[0]) throw new HttpError(404, 'Cuenta no encontrada');
    await audit(req.user!.id, 'bank_account.update', 'bank_account', req.params.id, body);
    res.json(updated[0]);
  }),
);

r.delete(
  '/bank-accounts/:id',
  ah(async (req, res) => {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, req.params.id));
    await audit(req.user!.id, 'bank_account.delete', 'bank_account', req.params.id);
    res.json({ ok: true });
  }),
);

r.post(
  '/rounds/reset',
  ah(async (req, res) => {
    const previous = await getRankings('todo-rd', 1);
    const round = await resetRound(req.user!.id);
    await audit(req.user!.id, 'round.reset', 'round', round.id, {
      previousChampion: previous[0]?.profile.handle ?? null,
    });
    res.json({ round, previousChampion: previous[0] ?? null });
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
