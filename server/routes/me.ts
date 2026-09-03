import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  bids,
  favorites,
  profiles,
  categories,
  users,
  referrals,
  creditTransactions,
  notifications,
  reviews,
} from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';
import { markRead } from '../lib/notify';
import { getRankings } from '../lib/rankings';
import { minNextBid } from '../../shared/bidding';
import { provinceName, NATIONAL_SLUG } from '../../shared/provinces';
import { normalizeRefCode } from '../../shared/referral';
import type { RankingEntry } from '../../shared/types';

const r = Router();
r.use(requireAuth);

r.get(
  '/',
  ah(async (req, res) => {
    // `hasBids` gobierna la UI de subasta en el cliente (junto con accountType).
    let hasBids = false;
    try {
      const [row] = await db
        .select({ id: bids.id })
        .from(bids)
        .where(eq(bids.userId, req.user!.id))
        .limit(1);
      hasBids = Boolean(row);
    } catch {
      hasBids = false;
    }
    res.json({ ...req.user, hasBids });
  }),
);

/** Reseñas que YO he escrito (para el panel del consumidor). */
r.get(
  '/reviews',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        ownerReply: reviews.ownerReply,
        createdAt: reviews.createdAt,
        profileId: profiles.id,
        profileName: profiles.name,
        profileAvatar: profiles.avatarUrl,
      })
      .from(reviews)
      .innerJoin(profiles, eq(profiles.id, reviews.profileId))
      .where(eq(reviews.userId, req.user!.id))
      .orderBy(desc(reviews.createdAt));
    res.json(rows);
  }),
);

/** Mis notificaciones (las últimas 40). */
r.get(
  '/notifications',
  ah(async (req, res) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(40);
    res.json(rows);
  }),
);

/** Marca como leídas (todas, o las de `ids`). */
r.post(
  '/notifications/read',
  ah(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
    await markRead(req.user!.id, ids);
    res.json({ ok: true });
  }),
);

/** Registra quién invitó a este usuario (una sola vez). */
r.post(
  '/referral',
  ah(async (req, res) => {
    const raw = z.object({ code: z.string().min(1).max(30) }).parse(req.body).code;
    const code = normalizeRefCode(raw);
    if (!code) throw new HttpError(400, 'Código de invitación inválido');

    const me = (await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1))[0]!;
    if (me.referredByCode) return res.json({ ok: true, already: true });

    const referrer = (
      await db.select().from(users).where(eq(users.referralCode, code)).limit(1)
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
        province: profiles.province,
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

/**
 * Estado de subasta de cada negocio del usuario: posición, si es #1, y el monto
 * exacto para recuperar/tomar el #1. Alimenta el botón "Recuperar #1" del panel.
 */
r.get(
  '/rank',
  ah(async (req, res) => {
    const mine = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        province: profiles.province,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.ownerUserId, req.user!.id));

    const cache = new Map<string, RankingEntry[]>();
    const rankingFor = async (cat: string, prov?: string) => {
      const key = `${cat}:${prov ?? 'nat'}`;
      if (!cache.has(key)) cache.set(key, await getRankings(cat, prov, 100));
      return cache.get(key)!;
    };

    const out = [];
    for (const b of mine) {
      const prov = b.province && b.province !== NATIONAL_SLUG ? b.province : undefined;
      const ranking = await rankingFor(b.categorySlug, prov);
      const idx = ranking.findIndex((e) => e.profile.id === b.id);
      const position = idx >= 0 ? idx + 1 : null;
      const isLeader = position === 1;
      const leader = ranking[0];
      const myEntry = idx >= 0 ? ranking[idx] : null;
      const leaderTotalDop = leader?.totalDop ?? 0;
      const myTotalDop = myEntry?.totalDop ?? 0;
      out.push({
        profileId: b.id,
        name: b.name,
        categoryName: b.categoryName,
        provinceName: prov ? provinceName(prov) : 'Todo RD',
        position,
        isLeader,
        leaderName: leader && !isLeader ? leader.profile.name : null,
        leaderTotalDop,
        myTotalDop,
        minBidDop: minNextBid({ leaderTotalDop, myTotalDop, iAmLeader: isLeader }),
      });
    }
    res.json(out);
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
      })
      .from(bids)
      .innerJoin(profiles, eq(profiles.id, bids.profileId))
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
