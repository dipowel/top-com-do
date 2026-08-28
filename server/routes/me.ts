import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  bids,
  favorites,
  profiles,
  categories,
  paymentReceipts,
  users,
  referrals,
  creditTransactions,
} from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  res.json(req.user);
});

/** Registra quién invitó a este usuario (una sola vez). */
r.post(
  '/referral',
  ah(async (req, res) => {
    const { code } = z.object({ code: z.string().min(3).max(20) }).parse(req.body);
    const me = (await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1))[0]!;
    if (me.referredByCode) return res.json({ ok: true, already: true });

    const referrer = (
      await db.select().from(users).where(eq(users.referralCode, code.trim().toUpperCase())).limit(1)
    )[0];
    if (!referrer) throw new HttpError(404, 'Código de invitación inválido');
    if (referrer.id === me.id) throw new HttpError(400, 'No puedes usar tu propio código');

    await db.update(users).set({ referredByCode: referrer.referralCode }).where(eq(users.id, me.id));
    await db
      .insert(referrals)
      .values({ referrerUserId: referrer.id, referredUserId: me.id, status: 'pending' })
      .onConflictDoNothing();
    await audit(me.id, 'referral.registered', 'referral', referrer.id, { code });
    res.status(201).json({ ok: true });
  }),
);

/** Referidos que YO invité y su estado. */
r.get(
  '/referrals',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: referrals.id,
        status: referrals.status,
        bonusDop: referrals.bonusDop,
        createdAt: referrals.createdAt,
        approvedAt: referrals.approvedAt,
        referredEmail: users.email,
        referredName: users.displayName,
      })
      .from(referrals)
      .leftJoin(users, eq(users.id, referrals.referredUserId))
      .where(eq(referrals.referrerUserId, req.user!.id))
      .orderBy(desc(referrals.createdAt));
    res.json(rows.map((x) => ({ ...x, bonusDop: Number(x.bonusDop) })));
  }),
);

/** Perfiles que yo administro (para editarlos). */
r.get(
  '/profiles',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        handle: profiles.handle,
        avatarUrl: profiles.avatarUrl,
        subcategory: profiles.subcategory,
        tagline: profiles.tagline,
        whatsapp: profiles.whatsapp,
        instagramUrl: profiles.instagramUrl,
        websiteUrl: profiles.websiteUrl,
        city: profiles.city,
        address: profiles.address,
        latitude: profiles.latitude,
        longitude: profiles.longitude,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.ownerUserId, req.user!.id))
      .orderBy(desc(profiles.createdAt));
    res.json(
      rows.map((x) => ({
        ...x,
        latitude: x.latitude != null ? Number(x.latitude) : null,
        longitude: x.longitude != null ? Number(x.longitude) : null,
      })),
    );
  }),
);

/** Movimientos de mi saldo de crédito. */
r.get(
  '/credits',
  ah(async (req, res) => {
    const rows = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, req.user!.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(100);
    res.json(rows.map((x) => ({ ...x, amountDop: Number(x.amountDop) })));
  }),
);

r.get(
  '/bids',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: bids.id,
        amountDop: bids.amountDop,
        currency: bids.currency,
        amountOriginal: bids.amountOriginal,
        method: bids.method,
        status: bids.status,
        reference: bids.reference,
        createdAt: bids.createdAt,
        verifiedAt: bids.verifiedAt,
        profileId: profiles.id,
        profileName: profiles.name,
        profileHandle: profiles.handle,
        profileAvatar: profiles.avatarUrl,
        receiptUrl: paymentReceipts.fileUrl,
      })
      .from(bids)
      .innerJoin(profiles, eq(profiles.id, bids.profileId))
      .leftJoin(paymentReceipts, eq(paymentReceipts.bidId, bids.id))
      .where(eq(bids.userId, req.user!.id))
      .orderBy(desc(bids.createdAt));
    res.json(
      rows.map((x) => ({
        ...x,
        amountDop: Number(x.amountDop),
        amountOriginal: Number(x.amountOriginal),
      })),
    );
  }),
);

r.get(
  '/favorites',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        handle: profiles.handle,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        whatsapp: profiles.whatsapp,
        city: profiles.city,
      })
      .from(favorites)
      .innerJoin(profiles, eq(profiles.id, favorites.profileId))
      .where(eq(favorites.userId, req.user!.id))
      .orderBy(desc(favorites.createdAt));
    res.json(rows);
  }),
);

r.post(
  '/favorites/:profileId',
  ah(async (req, res) => {
    await db
      .insert(favorites)
      .values({ userId: req.user!.id, profileId: req.params.profileId })
      .onConflictDoNothing();
    res.status(201).json({ ok: true });
  }),
);

r.delete(
  '/favorites/:profileId',
  ah(async (req, res) => {
    await db
      .delete(favorites)
      .where(and(eq(favorites.userId, req.user!.id), eq(favorites.profileId, req.params.profileId)));
    res.json({ ok: true });
  }),
);

export default r;
