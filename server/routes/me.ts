import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { bids, favorites, profiles, paymentReceipts } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  res.json(req.user);
});

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
