import { Router } from 'express';
import { and, desc, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { profiles, categories, bids, users, reviews } from '../../shared/schema';
import { rankingWindowStart } from '../../shared/bidding';
import { ah } from '../lib/asyncHandler';
import { requireAuth, loadUser } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';
import { PROVINCE_SLUGS, provinceName } from '../../shared/provinces';
import { assertCanReview, detectBombing, reviewSummary } from '../lib/reviews';
import { clientIpHash } from '../lib/ip';
import { REVIEW_COMMENT_MAX, isValidRating } from '../../shared/reviews';
import type { ReviewDTO } from '../../shared/types';

const r = Router();

const profileColumns = {
  id: profiles.id,
  ownerUserId: profiles.ownerUserId,
  name: profiles.name,
  handle: profiles.handle,
  avatarUrl: profiles.avatarUrl,
  bio: profiles.bio,
  tagline: profiles.tagline,
  subcategory: profiles.subcategory,
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
};

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return v as null;
  return Number(v);
}

r.get(
  '/',
  ah(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const subcategory =
      typeof req.query.subcategory === 'string' && req.query.subcategory.trim()
        ? req.query.subcategory.trim()
        : undefined;
    const rows = await db
      .select(profileColumns)
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(
        and(
          eq(profiles.isActive, true),
          category && category !== 'todo-rd' ? eq(categories.slug, category) : undefined,
          subcategory ? eq(profiles.subcategory, subcategory) : undefined,
        ),
      )
      .orderBy(desc(profiles.createdAt));
    res.json(
      rows.map((x) => ({
        ...x,
        provinceName: x.province ? provinceName(x.province) : null,
        latitude: numOrNull(x.latitude),
        longitude: numOrNull(x.longitude),
      })),
    );
  }),
);

const imageValue = z
  .string()
  .max(220_000)
  .refine((v) => /^https?:\/\//.test(v) || /^data:image\//.test(v), 'Imagen inválida');

const linkValue = z
  .string()
  .max(300)
  .refine((v) => /^https?:\/\//.test(v) || /^\+?[\d\s()-]{6,}$/.test(v), 'Enlace inválido');

const createSchema = z.object({
  name: z.string().min(2).max(80),
  handle: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_.-]+$/i, 'Solo letras, números, punto, guion y guion bajo')
    .optional(),
  categorySlug: z.string().min(1),
  subcategory: z.string().max(60).optional(),
  tagline: z.string().max(60).optional(),
  bio: z.string().max(400).optional(),
  whatsapp: z.string().max(30).optional(),
  instagramUrl: linkValue.optional(),
  websiteUrl: linkValue.optional(),
  province: z.enum(PROVINCE_SLUGS as [string, ...string[]]).optional(),
  city: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  avatarUrl: imageValue.optional(),
});

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 34);
  return base || 'perfil';
}

r.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = createSchema.parse(req.body);

    const cat = await db.select().from(categories).where(eq(categories.slug, body.categorySlug)).limit(1);
    if (!cat[0]) throw new HttpError(400, 'Categoría inválida');

    // handle: usa el dado, o genera uno único a partir del nombre
    let handle = (body.handle || slugify(body.name)).toLowerCase();
    for (let i = 0; i < 50; i++) {
      const taken = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
      if (!taken[0]) break;
      if (body.handle) throw new HttpError(409, 'Ese handle ya está en uso');
      handle = `${slugify(body.name)}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const inserted = await db
      .insert(profiles)
      .values({
        name: body.name,
        handle,
        categoryId: cat[0].id,
        subcategory: body.subcategory,
        tagline: body.tagline,
        bio: body.bio ?? body.tagline,
        whatsapp: body.whatsapp,
        instagramUrl: body.instagramUrl,
        websiteUrl: body.websiteUrl,
        province: body.province,
        city: body.city,
        address: body.address,
        latitude: body.latitude?.toFixed(7),
        longitude: body.longitude?.toFixed(7),
        avatarUrl: body.avatarUrl,
        ownerUserId: req.user!.id,
      })
      .returning();

    // Al publicar su primer negocio, el consumidor pasa a "comerciante".
    await db
      .update(users)
      .set({ accountType: 'merchant' })
      .where(and(eq(users.id, req.user!.id), eq(users.accountType, 'consumer')));

    await audit(req.user!.id, 'profile.create', 'profile', inserted[0]!.id, { handle, name: body.name });
    res.status(201).json(inserted[0]);
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    const rows = await db
      .select(profileColumns)
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.id, req.params.id))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, 'Perfil no encontrado');
    res.json({
      ...rows[0],
      provinceName: rows[0].province ? provinceName(rows[0].province) : null,
      latitude: numOrNull(rows[0].latitude),
      longitude: numOrNull(rows[0].longitude),
      reviewSummary: await reviewSummary(rows[0].id),
    });
  }),
);

const updateSchema = createSchema.partial().omit({ handle: true });

r.patch(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const existing = await db.select().from(profiles).where(eq(profiles.id, req.params.id)).limit(1);
    if (!existing[0]) throw new HttpError(404, 'Perfil no encontrado');
    const isOwner = existing[0].ownerUserId === req.user!.id;
    const isAdmin = req.user!.role !== 'user';
    if (!isOwner && !isAdmin) throw new HttpError(403, 'Solo el dueño puede editar este perfil');

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.subcategory !== undefined) patch.subcategory = body.subcategory || null;
    if (body.tagline !== undefined) patch.tagline = body.tagline || null;
    if (body.bio !== undefined) patch.bio = body.bio || null;
    if (body.whatsapp !== undefined) patch.whatsapp = body.whatsapp || null;
    if (body.instagramUrl !== undefined) patch.instagramUrl = body.instagramUrl || null;
    if (body.websiteUrl !== undefined) patch.websiteUrl = body.websiteUrl || null;
    if (body.province !== undefined) patch.province = body.province || null;
    if (body.city !== undefined) patch.city = body.city || null;
    if (body.address !== undefined) patch.address = body.address || null;
    if (body.latitude !== undefined) patch.latitude = body.latitude != null ? body.latitude.toFixed(7) : null;
    if (body.longitude !== undefined) patch.longitude = body.longitude != null ? body.longitude.toFixed(7) : null;
    if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl || null;
    if (body.categorySlug) {
      const cat = await db.select().from(categories).where(eq(categories.slug, body.categorySlug)).limit(1);
      if (!cat[0]) throw new HttpError(400, 'Categoría inválida');
      patch.categoryId = cat[0].id;
    }

    const updated = await db.update(profiles).set(patch).where(eq(profiles.id, req.params.id)).returning();
    await audit(req.user!.id, 'profile.update', 'profile', req.params.id, Object.keys(patch));
    res.json({
      ...updated[0],
      latitude: numOrNull(updated[0]!.latitude),
      longitude: numOrNull(updated[0]!.longitude),
    });
  }),
);

r.get(
  '/:id/bids',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: bids.id,
        amountDop: bids.amountDop,
        method: bids.method,
        createdAt: bids.createdAt,
        verifiedAt: bids.verifiedAt,
        bidderName: users.displayName,
      })
      .from(bids)
      .leftJoin(users, eq(users.id, bids.userId))
      .where(
        and(
          eq(bids.profileId, req.params.id),
          eq(bids.status, 'verified'),
          gte(bids.verifiedAt, rankingWindowStart()),
        ),
      )
      .orderBy(desc(bids.verifiedAt));
    res.json(rows.map((x) => ({ ...x, amountDop: Number(x.amountDop) })));
  }),
);

// ---------------- Reseñas ----------------
function toReviewDTO(row: {
  id: string;
  rating: number;
  comment: string | null;
  status: 'published' | 'flagged' | 'hidden';
  ownerReply: string | null;
  ownerReplyAt: Date | null;
  createdAt: Date;
  authorName: string | null;
  userId: string;
}, meId?: string): ReviewDTO {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    ownerReply: row.ownerReply,
    ownerReplyAt: row.ownerReplyAt ? row.ownerReplyAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    authorName: row.authorName || 'Usuario',
    isMine: !!meId && row.userId === meId,
  };
}

r.get(
  '/:id/reviews',
  ah(async (req, res) => {
    const me = await loadUser(req).catch(() => null);
    const prof = await db
      .select({ id: profiles.id, ownerUserId: profiles.ownerUserId })
      .from(profiles)
      .where(eq(profiles.id, req.params.id))
      .limit(1);
    if (!prof[0]) throw new HttpError(404, 'Perfil no encontrado');

    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        ownerReply: reviews.ownerReply,
        ownerReplyAt: reviews.ownerReplyAt,
        createdAt: reviews.createdAt,
        userId: reviews.userId,
        authorName: users.displayName,
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(eq(reviews.profileId, req.params.id))
      .orderBy(desc(reviews.createdAt));

    // Público: solo publicadas. Admin y el propio autor ven también las suyas.
    const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';
    const visible = rows.filter(
      (x) => x.status === 'published' || isAdmin || (me && x.userId === me.id),
    );
    const mine = me ? rows.find((x) => x.userId === me.id) : undefined;

    res.json({
      summary: await reviewSummary(req.params.id),
      items: visible.map((x) => toReviewDTO(x, me?.id)),
      mine: mine ? toReviewDTO(mine, me?.id) : null,
      canReview: !!me && prof[0].ownerUserId !== me.id,
    });
  }),
);

r.post(
  '/:id/reviews',
  requireAuth,
  ah(async (req, res) => {
    const body = z
      .object({ rating: z.number(), comment: z.string().max(REVIEW_COMMENT_MAX).optional() })
      .parse(req.body);
    if (!isValidRating(body.rating)) throw new HttpError(400, 'La calificación debe ser de 1 a 5.');

    const prof = await db
      .select({ id: profiles.id, ownerUserId: profiles.ownerUserId, isActive: profiles.isActive })
      .from(profiles)
      .where(eq(profiles.id, req.params.id))
      .limit(1);
    if (!prof[0] || !prof[0].isActive) throw new HttpError(404, 'Perfil no encontrado');

    const ipHash = clientIpHash(req);
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
    await assertCanReview({ profile: prof[0], userId: req.user!.id, ipHash, isAdmin });

    const existing = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.profileId, req.params.id), eq(reviews.userId, req.user!.id)))
      .limit(1);

    const saved = await db
      .insert(reviews)
      .values({
        profileId: req.params.id,
        userId: req.user!.id,
        rating: body.rating,
        comment: body.comment?.trim() || null,
        ipHash,
        status: 'published',
      })
      .onConflictDoUpdate({
        target: [reviews.profileId, reviews.userId],
        set: { rating: body.rating, comment: body.comment?.trim() || null, status: 'published', updatedAt: new Date() },
      })
      .returning();

    if (!isAdmin && body.rating <= 2) await detectBombing(req.params.id);
    await audit(req.user!.id, existing[0] ? 'review.update' : 'review.create', 'review', saved[0]!.id, {
      profileId: req.params.id,
      rating: body.rating,
    });

    res.status(201).json({ ok: true, summary: await reviewSummary(req.params.id) });
  }),
);

export default r;
