import { Router } from 'express';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { rankingWindowStart, RANKING_WINDOW_DAYS } from '../../shared/bidding';
import { z } from 'zod';
import { db } from '../db';
import {
  bids,
  profiles,
  categories,
  users,
  auditLog,
  referrals,
  reviews,
  jobs as J,
  jobReports,
  jobSources,
  jobImportRuns,
} from '../../shared/schema';
import { toJobCard, toJobDetail, expireStaleJobs } from '../lib/jobs';
import { pingIndexNow } from '../lib/indexnow';
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
import { PROVINCE_SLUGS, provinceName } from '../../shared/provinces';
import { canonicalCityName } from '../../shared/cities';

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
      .where(and(eq(bids.status, 'verified'), gte(bids.verifiedAt, rankingWindowStart())));
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
      windowDays: RANKING_WINDOW_DAYS,
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
        profileId: bids.profileId,
        profileName: profiles.name,
        profileHandle: profiles.handle,
        province: profiles.province,
        city: profiles.city,
        address: profiles.address,
        userId: bids.userId,
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

const adminEditBidSchema = z.object({
  profileName: z.string().min(2).max(80).optional(),
  amountDop: z.number().positive().max(10_000_000).optional(),
  status: z.enum(['pending', 'verified', 'rejected']).optional(),
  userEmail: z.string().email().max(200).optional(),
  province: z.string().max(40).optional(), // '' = quitar
  city: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
});

/**
 * Corrección manual rápida desde el admin: arregla un dato mal ingresado por
 * el cliente (nombre del negocio, monto, estado, correo o ubicación) sin
 * pasar por el flujo normal. No reenvía las notificaciones de
 * "puja verificada/rechazada" (eso ya lo cubre /bids/:id/verify); sí
 * mantiene sincronizados el ranking (recalcula en vivo) y el caché de líder.
 */
r.patch(
  '/bids/:id',
  ah(async (req, res) => {
    const body = adminEditBidSchema.parse(req.body);

    const bid = (await db.select().from(bids).where(eq(bids.id, req.params.id)).limit(1))[0];
    if (!bid) throw new HttpError(404, 'Puja no encontrada');

    if (body.province && !PROVINCE_SLUGS.includes(body.province)) {
      throw new HttpError(400, 'Provincia inválida');
    }

    if (body.userEmail) {
      const email = body.userEmail.trim().toLowerCase();
      const other = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (other[0] && other[0].id !== bid.userId) {
        throw new HttpError(409, 'Ese correo ya pertenece a otro usuario');
      }
      await db.update(users).set({ email }).where(eq(users.id, bid.userId));
    }

    const profilePatch: Record<string, unknown> = {};
    if (body.profileName !== undefined) profilePatch.name = body.profileName;
    if (body.province !== undefined) profilePatch.province = body.province || null;
    if (body.city !== undefined) profilePatch.city = body.city || null;
    if (body.address !== undefined) profilePatch.address = body.address || null;
    if (Object.keys(profilePatch).length) {
      await db.update(profiles).set(profilePatch).where(eq(profiles.id, bid.profileId));
    }

    const wasVerified = bid.status === 'verified';
    const bidPatch: Record<string, unknown> = {};
    if (body.amountDop !== undefined) {
      bidPatch.amountDop = body.amountDop.toFixed(2);
      if (bid.currency === 'DOP') bidPatch.amountOriginal = body.amountDop.toFixed(2);
    }
    if (body.status !== undefined) {
      bidPatch.status = body.status;
      bidPatch.verifiedAt = body.status === 'verified' ? new Date() : null;
      bidPatch.verifiedByUserId = body.status === 'verified' ? req.user!.id : null;
    }
    if (Object.keys(bidPatch).length) {
      await db.update(bids).set(bidPatch).where(eq(bids.id, bid.id));
    }

    const nowVerified = (body.status ?? bid.status) === 'verified';
    if (nowVerified && !wasVerified) {
      await onBidVerified(bid.id);
    }
    if (nowVerified && (body.amountDop !== undefined || body.status !== undefined)) {
      await checkDethronements(bid.profileId);
    }

    await audit(req.user!.id, 'admin.bid.edit', 'bid', bid.id, { changes: body });

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
        profileId: bids.profileId,
        profileName: profiles.name,
        profileHandle: profiles.handle,
        province: profiles.province,
        city: profiles.city,
        address: profiles.address,
        userId: bids.userId,
        bidderEmail: users.email,
        bidderName: users.displayName,
      })
      .from(bids)
      .innerJoin(profiles, eq(profiles.id, bids.profileId))
      .innerJoin(users, eq(users.id, bids.userId))
      .where(eq(bids.id, bid.id))
      .limit(1);
    const row = rows[0]!;
    res.json({ ...row, amountDop: Number(row.amountDop), amountOriginal: Number(row.amountOriginal) });
  }),
);

// ---------------- Negocios / directorio ----------------

/** Lista de negocios registrados (gratis o de pago) para moderación. */
r.get(
  '/profiles',
  ah(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 500);
    const since = rankingWindowStart();
    const owner = alias(users, 'owner');
    const activeBidTotal = sql<string>`(
      select coalesce(sum(${bids.amountDop}), 0) from ${bids}
      where ${bids.profileId} = ${profiles.id}
        and ${bids.status} = 'verified' and ${bids.verifiedAt} >= ${since}
    )`;

    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        handle: profiles.handle,
        tagline: profiles.tagline,
        bio: profiles.bio,
        categorySlug: categories.slug,
        categoryName: categories.name,
        province: profiles.province,
        city: profiles.city,
        whatsapp: profiles.whatsapp,
        instagramUrl: profiles.instagramUrl,
        latitude: profiles.latitude,
        longitude: profiles.longitude,
        isActive: profiles.isActive,
        createdAt: profiles.createdAt,
        ownerEmail: owner.email,
        activeBidTotal,
      })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .leftJoin(owner, eq(owner.id, profiles.ownerUserId))
      .where(
        and(
          q
            ? sql`(${profiles.name} ilike ${`%${q}%`} or ${profiles.handle} ilike ${`%${q}%`})`
            : undefined,
          status === 'active' ? eq(profiles.isActive, true) : undefined,
          status === 'inactive' ? eq(profiles.isActive, false) : undefined,
        ),
      )
      .orderBy(desc(profiles.createdAt))
      .limit(limit);

    let out = rows.map((x) => ({
      ...x,
      latitude: x.latitude != null ? Number(x.latitude) : null,
      longitude: x.longitude != null ? Number(x.longitude) : null,
      activeBidTotal: Number(x.activeBidTotal),
      isPaid: Number(x.activeBidTotal) > 0,
      provinceName: x.province ? provinceName(x.province) : null,
    }));
    if (status === 'paid') out = out.filter((x) => x.isPaid);
    if (status === 'free') out = out.filter((x) => !x.isPaid);
    res.json(out);
  }),
);

const adminEditProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  tagline: z.string().max(60).optional(),
  bio: z.string().max(400).optional(),
  categorySlug: z.string().min(1).optional(),
  province: z.string().max(40).optional(), // '' = quitar
  city: z.string().max(60).optional(),
  whatsapp: z.string().max(30).optional(),
  instagramUrl: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** Editar cualquier campo clave de un negocio (incluye activarlo/desactivarlo). */
r.patch(
  '/profiles/:id',
  ah(async (req, res) => {
    const body = adminEditProfileSchema.parse(req.body);
    const existing = (
      await db.select().from(profiles).where(eq(profiles.id, req.params.id)).limit(1)
    )[0];
    if (!existing) throw new HttpError(404, 'Negocio no encontrado');

    if (body.province && !PROVINCE_SLUGS.includes(body.province)) {
      throw new HttpError(400, 'Provincia inválida');
    }

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.tagline !== undefined) patch.tagline = body.tagline || null;
    if (body.bio !== undefined) patch.bio = body.bio || null;
    if (body.province !== undefined) patch.province = body.province || null;
    if (body.city !== undefined) patch.city = canonicalCityName(body.city) ?? null;
    if (body.whatsapp !== undefined) patch.whatsapp = body.whatsapp || null;
    if (body.instagramUrl !== undefined) patch.instagramUrl = body.instagramUrl || null;
    if (body.latitude !== undefined)
      patch.latitude = body.latitude != null ? body.latitude.toFixed(7) : null;
    if (body.longitude !== undefined)
      patch.longitude = body.longitude != null ? body.longitude.toFixed(7) : null;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    if (body.categorySlug) {
      const cat = (
        await db.select().from(categories).where(eq(categories.slug, body.categorySlug)).limit(1)
      )[0];
      if (!cat) throw new HttpError(400, 'Categoría inválida');
      patch.categoryId = cat.id;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nada que cambiar');

    const [updated] = await db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, req.params.id))
      .returning();
    await audit(req.user!.id, 'admin.profile.edit', 'profile', req.params.id, { changes: body });

    if (
      patch.categoryId !== undefined ||
      patch.province !== undefined ||
      patch.isActive !== undefined
    ) {
      try {
        await checkDethronements(req.params.id);
      } catch {
        /* no bloquea la edición */
      }
    }

    res.json({
      ...updated,
      latitude: updated!.latitude != null ? Number(updated!.latitude) : null,
      longitude: updated!.longitude != null ? Number(updated!.longitude) : null,
    });
  }),
);

/** "Eliminar" = borrado lógico: sale del directorio y los rankings al instante. */
r.delete(
  '/profiles/:id',
  ah(async (req, res) => {
    const existing = (
      await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, req.params.id)).limit(1)
    )[0];
    if (!existing) throw new HttpError(404, 'Negocio no encontrado');
    await db.update(profiles).set({ isActive: false }).where(eq(profiles.id, req.params.id));
    await audit(req.user!.id, 'admin.profile.deactivate', 'profile', req.params.id, {});
    try {
      await checkDethronements(req.params.id);
    } catch {
      /* no bloquea */
    }
    res.json({ ok: true });
  }),
);

// ---------------- Empleos ----------------

const JOB_STATUSES = [
  'draft',
  'pending_review',
  'possible_duplicate',
  'published',
  'expired',
  'removed',
  'closed',
] as const;
type JobStatusValue = (typeof JOB_STATUSES)[number];

r.get(
  '/jobs',
  ah(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const source = typeof req.query.source === 'string' ? req.query.source : '';
    const rows = await db
      .select()
      .from(J)
      .where(
        and(
          q ? sql`(${J.title} ilike ${`%${q}%`} or ${J.companyName} ilike ${`%${q}%`})` : undefined,
          status && (JOB_STATUSES as readonly string[]).includes(status)
            ? eq(J.status, status as JobStatusValue)
            : undefined,
          source ? eq(J.sourcePlatform, source) : undefined,
        ),
      )
      .orderBy(desc(J.updatedAt))
      .limit(300);
    res.json(
      rows.map((row) => ({
        ...toJobCard(row),
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        firstSeenAt: row.firstSeenAt,
        sourcePlatform: row.sourcePlatform,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        applicationUrl: row.applicationUrl,
        duplicateOfId: row.duplicateOfId,
        indexingStatus: row.indexingStatus,
        indexingLastError: row.indexingLastError,
      })),
    );
  }),
);

r.get(
  '/jobs/:id',
  ah(async (req, res) => {
    const [row] = await db.select().from(J).where(eq(J.id, req.params.id)).limit(1);
    if (!row) throw new HttpError(404, 'Vacante no encontrada');
    res.json(toJobDetail(row, []));
  }),
);

const adminJobPatch = z.object({
  title: z.string().min(4).max(140).optional(),
  companyName: z.string().min(2).max(120).optional(),
  category: z.string().max(60).optional(),
  province: z.string().max(40).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  isFeatured: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

async function afterJobStatusChange(slug: string, before: string, after: string) {
  const { queueJobIndexing } = await import('../lib/googleIndexing');
  if (after === 'published' && before !== 'published') {
    pingIndexNow([`/empleo/${slug}`, '/empleos']);
    await queueJobIndexing([slug], 'URL_UPDATED');
  } else if (before === 'published' && after !== 'published') {
    await queueJobIndexing([slug], 'URL_DELETED');
  }
}

r.patch(
  '/jobs/:id',
  ah(async (req, res) => {
    const body = adminJobPatch.parse(req.body);
    const [existing] = await db.select().from(J).where(eq(J.id, req.params.id)).limit(1);
    if (!existing) throw new HttpError(404, 'Vacante no encontrada');
    if (body.province && !PROVINCE_SLUGS.includes(body.province)) throw new HttpError(400, 'Provincia inválida');

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) patch.title = body.title;
    if (body.companyName !== undefined) patch.companyName = body.companyName;
    if (body.category !== undefined) patch.category = body.category;
    if (body.province !== undefined) patch.province = body.province || null;
    if (body.isFeatured !== undefined) patch.isFeatured = body.isFeatured;
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.status !== undefined) {
      patch.status = body.status;
      if (body.status === 'published' && !existing.publishedAt) patch.publishedAt = new Date();
      if (['expired', 'removed', 'closed'].includes(body.status)) {
        patch.removedAt = new Date();
        patch.removedReason = 'admin';
      }
    }

    const [row] = await db.update(J).set(patch).where(eq(J.id, existing.id)).returning();
    await audit(req.user!.id, 'admin.job.edit', 'job', existing.id, { changes: body });
    if (body.status && body.status !== existing.status) {
      await afterJobStatusChange(row!.slug, existing.status, body.status);
    }
    res.json({ ...toJobCard(row!), status: row!.status });
  }),
);

r.delete(
  '/jobs/:id',
  ah(async (req, res) => {
    const [existing] = await db
      .select({ id: J.id, slug: J.slug, status: J.status })
      .from(J)
      .where(eq(J.id, req.params.id))
      .limit(1);
    if (!existing) throw new HttpError(404, 'Vacante no encontrada');
    await db
      .update(J)
      .set({ status: 'removed', updatedAt: new Date(), removedAt: new Date(), removedReason: 'admin' })
      .where(eq(J.id, existing.id));
    await audit(req.user!.id, 'admin.job.remove', 'job', existing.id, {});
    await afterJobStatusChange(existing.slug, existing.status, 'removed');
    res.json({ ok: true });
  }),
);

/** Acciones rápidas de moderación. */
r.post(
  '/jobs/:id/:action',
  ah(async (req, res) => {
    const action = req.params.action;
    const [existing] = await db.select().from(J).where(eq(J.id, req.params.id)).limit(1);
    if (!existing) throw new HttpError(404, 'Vacante no encontrada');

    let next: JobStatusValue | null = null;
    if (action === 'approve' || action === 'not-duplicate') next = 'published';
    else if (action === 'reject') next = 'removed';
    else if (action === 'reimport') {
      if (!existing.sourceId) throw new HttpError(400, 'Vacante sin fuente');
      const [src] = await db.select().from(jobSources).where(eq(jobSources.id, existing.sourceId)).limit(1);
      if (!src) throw new HttpError(404, 'Fuente no encontrada');
      const { runSource } = await import('../lib/jobImport');
      const out = await runSource(src, 15_000);
      await audit(req.user!.id, 'admin.job.reimport', 'job', existing.id, out);
      return res.json({ ok: true, run: out });
    } else if (action === 'reindex') {
      const { reindexJob } = await import('../lib/googleIndexing');
      const type = existing.status === 'published' ? 'URL_UPDATED' : 'URL_DELETED';
      const out = await reindexJob(existing.slug, type);
      await audit(req.user!.id, 'admin.job.reindex', 'job', existing.id, out);
      return res.json(out);
    } else {
      throw new HttpError(400, 'Acción no válida');
    }

    const patch: Record<string, unknown> = { status: next, updatedAt: new Date() };
    if (next === 'published' && !existing.publishedAt) patch.publishedAt = new Date();
    if (next === 'removed') {
      patch.removedAt = new Date();
      patch.removedReason = 'admin';
    }
    if (action === 'not-duplicate') patch.duplicateOfId = null;
    const [row] = await db.update(J).set(patch).where(eq(J.id, existing.id)).returning();
    await audit(req.user!.id, `admin.job.${action}`, 'job', existing.id, {});
    await afterJobStatusChange(row!.slug, existing.status, next);
    res.json({ ok: true, status: next });
  }),
);

// ---------------- Fuentes de empleo ----------------

r.get(
  '/job-sources',
  ah(async (_req, res) => {
    const rows = await db.select().from(jobSources).orderBy(jobSources.name);
    const counts = await db
      .select({ platform: J.sourcePlatform, n: sql<number>`count(*)::int` })
      .from(J)
      .where(eq(J.status, 'published'))
      .groupBy(J.sourcePlatform);
    const byPlatform = Object.fromEntries(counts.map((c) => [c.platform, c.n]));
    res.json(rows.map((s) => ({ ...s, activeJobs: byPlatform[s.platform] ?? 0 })));
  }),
);

const jobSourcePatch = z.object({
  name: z.string().min(2).max(120).optional(),
  isEnabled: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  authorizationStatus: z.enum(['none', 'requested', 'authorized', 'denied']).optional(),
  defaultCategory: z.string().max(60).nullable().optional(),
  feedUrl: z.string().url().max(500).nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

r.patch(
  '/job-sources/:id',
  ah(async (req, res) => {
    const body = jobSourcePatch.parse(req.body);
    const [existing] = await db.select().from(jobSources).where(eq(jobSources.id, req.params.id)).limit(1);
    if (!existing) throw new HttpError(404, 'Fuente no encontrada');
    if (existing.platform === 'direct' && body.isEnabled === false) {
      throw new HttpError(400, 'La publicación directa no se puede desactivar');
    }
    const [row] = await db
      .update(jobSources)
      .set({ ...body, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(jobSources.id, existing.id))
      .returning();
    await audit(req.user!.id, 'admin.jobSource.edit', 'jobSource', existing.id, { changes: Object.keys(body) });
    res.json(row);
  }),
);

const jobSourceCreate = jobSourcePatch.extend({
  platform: z.enum(['greenhouse', 'lever', 'csv', 'jooble']),
  name: z.string().min(2).max(120),
  sourceType: z.enum(['direct', 'ats', 'api', 'feed', 'partner']).default('feed'),
});

r.post(
  '/job-sources',
  ah(async (req, res) => {
    const body = jobSourceCreate.parse(req.body);
    const [row] = await db
      .insert(jobSources)
      .values({
        platform: body.platform,
        name: body.name,
        sourceType: body.sourceType,
        isEnabled: body.isEnabled ?? false,
        autoPublish: body.autoPublish ?? false,
        authorizationStatus: body.authorizationStatus ?? 'none',
        defaultCategory: body.defaultCategory ?? null,
        feedUrl: body.feedUrl ?? null,
        config: (body.config ?? null) as never,
        notes: body.notes ?? null,
      })
      .onConflictDoNothing({ target: jobSources.platform })
      .returning();
    if (!row) throw new HttpError(409, 'Ya existe una fuente con esa plataforma');
    await audit(req.user!.id, 'admin.jobSource.create', 'jobSource', row.id, { platform: body.platform });
    res.status(201).json(row);
  }),
);

r.get(
  '/job-import-runs',
  ah(async (_req, res) => {
    const rows = await db
      .select()
      .from(jobImportRuns)
      .orderBy(desc(jobImportRuns.startedAt))
      .limit(60);
    res.json(rows);
  }),
);

r.get(
  '/job-reports',
  ah(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'open';
    const rows = await db
      .select({
        id: jobReports.id,
        reason: jobReports.reason,
        detail: jobReports.detail,
        status: jobReports.status,
        createdAt: jobReports.createdAt,
        jobId: J.id,
        jobSlug: J.slug,
        jobTitle: J.title,
        reporterEmail: users.email,
      })
      .from(jobReports)
      .innerJoin(J, eq(J.id, jobReports.jobId))
      .leftJoin(users, eq(users.id, jobReports.reporterUserId))
      .where(status ? eq(jobReports.status, status) : undefined)
      .orderBy(desc(jobReports.createdAt))
      .limit(200);
    res.json(rows);
  }),
);

r.post(
  '/job-reports/:id/resolve',
  ah(async (req, res) => {
    const body = z.object({ status: z.enum(['reviewed', 'dismissed']) }).parse(req.body);
    await db.update(jobReports).set({ status: body.status }).where(eq(jobReports.id, req.params.id));
    await audit(req.user!.id, `admin.jobReport.${body.status}`, 'jobReport', req.params.id, {});
    res.json({ ok: true });
  }),
);

r.post(
  '/jobs/expire',
  ah(async (req, res) => {
    const { expired } = await expireStaleJobs();
    await audit(req.user!.id, 'admin.jobs.expire', 'job', null, { expired: expired.length });
    res.json({ expired: expired.length, slugs: expired });
  }),
);

r.post(
  '/jobs/import',
  ah(async (req, res) => {
    const { runDueSources } = await import('../lib/jobImport');
    const runs = await runDueSources();
    await audit(req.user!.id, 'admin.jobs.import', 'job', null, { runs: runs.length });
    res.json({ runs });
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
