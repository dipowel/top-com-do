import { createHash } from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { profileAvatarUrl } from '../../shared/site';
import { canonicalCityName } from '../../shared/cities';
import { profiles, categories, bids, users, reviews, businessEvents, rankLeaderHistory } from '../../shared/schema';
import { rankingWindowStart, minNextBid } from '../../shared/bidding';
import { ah } from '../lib/asyncHandler';
import { requireAuth, loadUser } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';
import { pingIndexNow } from '../lib/indexnow';
import { PROVINCE_SLUGS, provinceName, NATIONAL_SLUG } from '../../shared/provinces';
import { assertCanReview, detectBombing, reviewSummary } from '../lib/reviews';
import { clientIpHash } from '../lib/ip';
import { getRankings } from '../lib/rankings';
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
    const province =
      typeof req.query.province === 'string' &&
      PROVINCE_SLUGS.includes(req.query.province) &&
      req.query.province !== 'todo-rd'
        ? req.query.province
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
          province ? eq(profiles.province, province) : undefined,
        ),
      )
      .orderBy(desc(profiles.createdAt));
    res.json(
      rows.map((x) => ({
        ...x,
        avatarUrl: profileAvatarUrl(x.id, x.avatarUrl),
        provinceName: x.province ? provinceName(x.province) : null,
        latitude: numOrNull(x.latitude),
        longitude: numOrNull(x.longitude),
      })),
    );
  }),
);

/**
 * Logo/avatar del negocio servido como imagen real y cacheable. La BD lo guarda
 * como data URI base64; aquí se decodifica una vez y se sirve con caché de 1 año,
 * de modo que sea usable en Open Graph y datos estructurados (que exigen http(s)).
 */
r.get(
  '/:id/avatar',
  ah(async (req, res) => {
    const rows = await db
      .select({ avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, req.params.id))
      .limit(1);
    const raw = rows[0]?.avatarUrl;
    if (!raw) throw new HttpError(404, 'Sin logo');
    // Anula el `no-store` global de la API: esta imagen es inmutable.
    const cacheable = (v: string) => {
      res.setHeader('Cache-Control', v);
      res.setHeader('CDN-Cache-Control', v);
      res.setHeader('Vercel-CDN-Cache-Control', v);
      res.removeHeader('Pragma');
      res.removeHeader('Expires');
    };
    if (/^https?:\/\//.test(raw)) {
      cacheable('public, max-age=86400');
      return res.redirect(302, raw);
    }
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(raw);
    if (!m) throw new HttpError(404, 'Logo inválido');
    const buf = Buffer.from(m[2], 'base64');
    const etag = `"${createHash('sha1').update(buf).digest('hex')}"`;
    cacheable('public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.type(m[1]);
    return res.send(buf);
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
  // Obligatoria solo al CREAR un negocio (ver updateSchema = createSchema.partial() más abajo,
  // que la vuelve opcional para editar uno que ya existe y podría no tenerla aún).
  latitude: z.number({ required_error: 'Debes capturar la ubicación de tu negocio.' }).min(-90).max(90),
  longitude: z.number({ required_error: 'Debes capturar la ubicación de tu negocio.' }).min(-180).max(180),
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
        city: canonicalCityName(body.city),
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

    // IndexNow: la nueva ficha y sus landings de categoría/provincia.
    const prov = body.province && body.province !== 'todo-rd' ? body.province : null;
    pingIndexNow([
      `/p/${inserted[0]!.id}`,
      `/rd/${body.categorySlug}`,
      `/explorar/${body.categorySlug}`,
      ...(prov ? [`/rd/${body.categorySlug}/${prov}`] : []),
    ]);

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
      .where(and(eq(profiles.id, req.params.id), eq(profiles.isActive, true)))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, 'Perfil no encontrado');
    res.json({
      ...rows[0],
      avatarUrl: profileAvatarUrl(rows[0].id, rows[0].avatarUrl),
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
    if (body.city !== undefined) patch.city = canonicalCityName(body.city) ?? null;
    if (body.address !== undefined) patch.address = body.address || null;
    if (body.latitude !== undefined) patch.latitude = body.latitude != null ? body.latitude.toFixed(7) : null;
    if (body.longitude !== undefined) patch.longitude = body.longitude != null ? body.longitude.toFixed(7) : null;
    // Ignora la URL del endpoint (`/api/profiles/:id/avatar`) que la lectura pública
    // devuelve: solo un data URI nuevo cuenta como cambio de logo.
    if (body.avatarUrl !== undefined && !/\/api\/profiles\/[^/]+\/avatar$/.test(body.avatarUrl))
      patch.avatarUrl = body.avatarUrl || null;
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

// ---------------- Dashboard de métricas del negocio ----------------

const BUSINESS_EVENT_TYPES = [
  'business_view',
  'whatsapp_click',
  'location_click',
  'instagram_click',
  'website_click',
] as const;
const eventTypeSchema = z.enum(BUSINESS_EVENT_TYPES);

function deviceTypeFromUA(ua: string | undefined): string {
  const s = (ua || '').toLowerCase();
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobile|iphone|android/.test(s)) return 'mobile';
  return 'desktop';
}

/** Público a propósito: la mayoría de visitantes no tiene sesión. Nunca bloquea al visitante. */
r.post(
  '/:id/events',
  ah(async (req, res) => {
    const body = z
      .object({ eventType: eventTypeSchema, sessionId: z.string().max(80).optional() })
      .parse(req.body);

    const ipHash = clientIpHash(req);
    const [recent] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(businessEvents)
      .where(and(eq(businessEvents.ipHash, ipHash), gte(businessEvents.createdAt, sql`now() - interval '1 hour'`)));
    if ((recent?.n ?? 0) >= 60) throw new HttpError(429, 'Demasiados eventos. Intenta más tarde.');

    const prof = (
      await db
        .select({ province: profiles.province, categorySlug: categories.slug })
        .from(profiles)
        .innerJoin(categories, eq(categories.id, profiles.categoryId))
        .where(eq(profiles.id, req.params.id))
        .limit(1)
    )[0];
    if (!prof) throw new HttpError(404, 'Perfil no encontrado');

    const me = await loadUser(req).catch(() => null);

    await db.insert(businessEvents).values({
      profileId: req.params.id,
      eventType: body.eventType,
      userId: me?.id ?? null,
      sessionId: body.sessionId ?? null,
      province: prof.province,
      category: prof.categorySlug,
      deviceType: deviceTypeFromUA(req.headers['user-agent']),
      ipHash,
    });
    res.status(201).json({ ok: true });
  }),
);

const RANGE_DAYS: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null };

/** Solo el dueño del negocio (o un admin) puede ver sus estadísticas — mismo criterio que /me/rank. */
r.get(
  '/:id/stats',
  requireAuth,
  ah(async (req, res) => {
    const prof = (
      await db
        .select({
          id: profiles.id,
          ownerUserId: profiles.ownerUserId,
          province: profiles.province,
          categoryId: profiles.categoryId,
          categorySlug: categories.slug,
          categoryName: categories.name,
        })
        .from(profiles)
        .innerJoin(categories, eq(categories.id, profiles.categoryId))
        .where(eq(profiles.id, req.params.id))
        .limit(1)
    )[0];
    if (!prof) throw new HttpError(404, 'Perfil no encontrado');

    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
    if (prof.ownerUserId !== req.user!.id && !isAdmin) {
      throw new HttpError(403, 'Solo el dueño del negocio puede ver estas estadísticas.');
    }

    const rangeParam = typeof req.query.range === 'string' ? req.query.range : '7d';
    const range = rangeParam in RANGE_DAYS ? rangeParam : '7d';
    const days = RANGE_DAYS[range];
    const since = days != null ? new Date(Date.now() - days * 86_400_000) : new Date(0);

    const counts = await db
      .select({ eventType: businessEvents.eventType, n: sql<number>`count(*)::int` })
      .from(businessEvents)
      .where(and(eq(businessEvents.profileId, prof.id), gte(businessEvents.createdAt, since)))
      .groupBy(businessEvents.eventType);
    const byType: Record<string, number> = Object.fromEntries(BUSINESS_EVENT_TYPES.map((t) => [t, 0]));
    for (const c of counts) if (c.eventType in byType) byType[c.eventType] = c.n;

    // Serie diaria (hasta 90 días) para el gráfico de actividad.
    const dailyResult = await db.execute(sql`
      SELECT to_char(created_at AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD') AS day,
             event_type, count(*)::int AS n
      FROM business_events
      WHERE profile_id = ${prof.id} AND created_at >= ${since}
      GROUP BY 1, 2
      ORDER BY 1
    `);
    const dailyMap = new Map<string, Record<string, number>>();
    for (const row of (dailyResult.rows ?? []) as Array<{ day: string; event_type: string; n: number }>) {
      const bucket = dailyMap.get(row.day) ?? {};
      bucket[row.event_type] = row.n;
      dailyMap.set(row.day, bucket);
    }
    const daily = [...dailyMap.entries()].map(([date, v]) => ({
      date,
      businessView: v.business_view ?? 0,
      whatsappClick: v.whatsapp_click ?? 0,
      locationClick: v.location_click ?? 0,
      instagramClick: v.instagram_click ?? 0,
      websiteClick: v.website_click ?? 0,
    }));

    // Ranking actual — mismo cálculo que /me/rank, misma función getRankings sin tocar.
    const prov = prof.province && prof.province !== NATIONAL_SLUG ? prof.province : undefined;
    const ranking = await getRankings(prof.categorySlug, prov, 500);
    const idx = ranking.findIndex((e) => e.profile.id === prof.id);
    const position = idx >= 0 ? idx + 1 : null;
    const isLeader = position === 1;
    const leader = ranking[0];
    const leaderTotalDop = leader?.totalDop ?? 0;
    const myTotalDop = idx >= 0 ? ranking[idx]!.totalDop : 0;
    const minBidDop = minNextBid({ leaderTotalDop, myTotalDop, iAmLeader: isLeader });

    // "Días en #1" dentro del rango, a partir del historial real de líder del ámbito.
    const scopeKey = `${prof.categorySlug}:${prov ?? 'national'}`;
    const history = await db
      .select({ startedAt: rankLeaderHistory.startedAt, endedAt: rankLeaderHistory.endedAt })
      .from(rankLeaderHistory)
      .where(and(eq(rankLeaderHistory.scopeKey, scopeKey), eq(rankLeaderHistory.profileId, prof.id)));
    const nowMs = Date.now();
    const sinceMs = since.getTime();
    let leaderMs = 0;
    for (const h of history) {
      const start = Math.max(h.startedAt.getTime(), sinceMs);
      const end = Math.min((h.endedAt ?? new Date(nowMs)).getTime(), nowMs);
      if (end > start) leaderMs += end - start;
    }
    const daysAsLeader = Math.round((leaderMs / 86_400_000) * 10) / 10;

    // Inversión real (pujas verificadas en el rango) y costo por interacción — solo si hay
    // datos suficientes de ambos lados; nunca se muestra RD$0.00 ni se divide entre cero.
    const [investedRow] = await db
      .select({ total: sql<string>`coalesce(sum(${bids.amountDop}), 0)` })
      .from(bids)
      .where(and(eq(bids.profileId, prof.id), eq(bids.status, 'verified'), gte(bids.verifiedAt, since)));
    const invested = Number(investedRow?.total ?? 0);
    const interactions = byType.whatsapp_click! + byType.location_click! + byType.instagram_click! + byType.website_click!;
    const costPerInteraction = invested > 0 && interactions > 0 ? invested / interactions : null;

    // Comparación cualitativa: promedio de vistas de otros negocios de la misma categoría en
    // el rango — nunca se expone el número exacto de un competidor puntual.
    const avgResult = await db.execute(sql`
      SELECT coalesce(avg(v.views), 0)::float8 AS avg_views
      FROM (
        SELECT be.profile_id, count(*) AS views
        FROM business_events be
        JOIN profiles p ON p.id = be.profile_id
        WHERE be.event_type = 'business_view'
          AND p.category_id = ${prof.categoryId}
          AND be.created_at >= ${since}
        GROUP BY be.profile_id
      ) v
    `);
    const avgViews = Number((avgResult.rows?.[0] as { avg_views?: number } | undefined)?.avg_views ?? 0);
    const comparison =
      byType.business_view! > 0 && byType.business_view! >= avgViews
        ? 'Tu negocio está entre los más vistos de esta categoría.'
        : 'Sigue construyendo tu visibilidad — cada semana cuenta.';

    res.json({
      range,
      counts: byType,
      daily,
      ranking: {
        position,
        isLeader,
        leaderName: leader && !isLeader ? leader.profile.name : null,
        leaderTotalDop,
        myTotalDop,
        minBidDop,
        categoryName: prof.categoryName,
        provinceName: prov ? provinceName(prov) : 'Todo RD',
        daysAsLeader,
      },
      investment:
        invested > 0 && costPerInteraction != null
          ? { investedDop: invested, interactions, costPerInteractionDop: costPerInteraction }
          : null,
      comparison,
    });
  }),
);

export default r;
