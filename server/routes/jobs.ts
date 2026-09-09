import { Router } from 'express';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { jobs as J, profiles, jobReports } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';
import { pingIndexNow } from '../lib/indexnow';
import { queueJobIndexing } from '../lib/googleIndexing';
import { contentHash } from '../../shared/job-normalize';
import { PROVINCE_SLUGS } from '../../shared/provinces';
import { canonicalCityName } from '../../shared/cities';
import { JOB_CATEGORY_SLUGS } from '../../shared/job-categories';
import {
  JOB_TYPE_VALUES,
  WORK_MODE_VALUES,
  SALARY_PERIOD_VALUES,
  dedupeKey,
  type JobType,
  type WorkMode,
  type SalaryPeriod,
} from '../../shared/jobs';
import { normalizePhone } from '../../shared/phone';
import {
  listJobs,
  getJobForRender,
  jobsForCompany,
  jobFacetCounts,
  maybeExpireJobs,
  toJobCard,
  toJobDetail,
  generateUniqueJobSlug,
  getCompanyJobsBySlug,
} from '../lib/jobs';
import { ensureDirectSource } from '../lib/jobSources';

const r = Router();

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Lista pública con búsqueda, filtros y paginación keyset. */
r.get(
  '/',
  ah(async (req, res) => {
    void maybeExpireJobs();
    const company = str(req.query.company);
    if (company) {
      res.json({ items: await jobsForCompany(company), nextCursor: null });
      return;
    }
    const data = await listJobs({
      q: str(req.query.q),
      category: str(req.query.category),
      province: str(req.query.province),
      city: str(req.query.city),
      workMode: str(req.query.modalidad) ?? str(req.query.workMode),
      jobType: str(req.query.tipo) ?? str(req.query.jobType),
      salaryMin: int(req.query.salario) ?? int(req.query.salaryMin),
      cursor: str(req.query.cursor) ?? null,
      limit: int(req.query.limit),
    });
    res.json(data);
  }),
);

/** Conteos por categoría / provincia (para chips y el guard de indexación). */
r.get(
  '/facets',
  ah(async (_req, res) => {
    res.json(await jobFacetCounts());
  }),
);

const applicationValues = z.object({
  applicationUrl: z
    .string()
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), 'La URL de aplicación debe empezar por http(s)://')
    .optional(),
  applicationEmail: z.string().email().max(200).optional(),
  contactWhatsapp: z.string().max(30).optional(),
});

const jobInputSchema = z
  .object({
    title: z.string().min(4).max(140),
    description: z.string().min(30).max(8000),
    requirements: z.string().max(4000).optional(),
    responsibilities: z.string().max(4000).optional(),
    companyId: z.string().uuid().nullable().optional(),
    companyName: z.string().min(2).max(120),
    category: z.enum(JOB_CATEGORY_SLUGS as [string, ...string[]]),
    province: z.enum(PROVINCE_SLUGS as [string, ...string[]]).optional(),
    city: z.string().max(60).optional(),
    locationText: z.string().max(200).optional(),
    // Dirección exacta — opcional; solo si el empleador la conoce (nunca inventar).
    streetAddress: z.string().max(160).optional(),
    postalCode: z.string().max(12).optional(),
    jobType: z.enum(JOB_TYPE_VALUES as [JobType, ...JobType[]]),
    workMode: z.enum(WORK_MODE_VALUES as [WorkMode, ...WorkMode[]]),
    salaryMin: z.number().int().min(0).max(100_000_000).nullable().optional(),
    salaryMax: z.number().int().min(0).max(100_000_000).nullable().optional(),
    salaryCurrency: z.enum(['DOP', 'USD']).optional(),
    salaryPeriod: z.enum(SALARY_PERIOD_VALUES as [SalaryPeriod, ...SalaryPeriod[]]).nullable().optional(),
    status: z.enum(['draft', 'published']).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .merge(applicationValues)
  .refine(
    (v) => v.applicationUrl || v.applicationEmail || v.contactWhatsapp,
    'Indica al menos una forma de aplicar (enlace, correo o WhatsApp)',
  );

/** Publicar una vacante. Cualquier usuario autenticado; el dueño puede adjuntar su negocio. */
r.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = jobInputSchema.parse(req.body);

    // Rate limit sencillo: máx. 10 vacantes por usuario en 24h.
    const [recent] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(J)
      .where(and(eq(J.postedByUserId, req.user!.id), gte(J.createdAt, sql`now() - interval '24 hours'`)));
    if ((recent?.n ?? 0) >= 10) throw new HttpError(429, 'Has alcanzado el límite de vacantes por día');

    let companyId: string | null = null;
    let companyName = body.companyName.trim();
    if (body.companyId) {
      const [prof] = await db
        .select({ id: profiles.id, name: profiles.name, ownerUserId: profiles.ownerUserId })
        .from(profiles)
        .where(eq(profiles.id, body.companyId))
        .limit(1);
      if (!prof) throw new HttpError(400, 'Negocio no encontrado');
      const isAdmin = req.user!.role !== 'user';
      if (prof.ownerUserId !== req.user!.id && !isAdmin) {
        throw new HttpError(403, 'Solo el dueño puede publicar vacantes de ese negocio');
      }
      companyId = prof.id;
      companyName = prof.name;
    }

    const province = body.province && body.province !== 'todo-rd' ? body.province : null;
    const status = body.status ?? 'published';
    const now = new Date();
    const city = canonicalCityName(body.city) ?? null;
    const slug = await generateUniqueJobSlug(body.title, body.city || (province ? province : null));
    const sourceId = await ensureDirectSource();
    const description = body.description.trim();

    const [row] = await db
      .insert(J)
      .values({
        slug,
        title: body.title.trim(),
        description,
        requirements: body.requirements?.trim() || null,
        responsibilities: body.responsibilities?.trim() || null,
        companyId,
        companyName,
        postedByUserId: req.user!.id,
        category: body.category,
        province,
        city,
        locationText: body.locationText?.trim() || null,
        streetAddress: body.streetAddress?.trim() || null,
        postalCode: body.postalCode?.trim() || null,
        jobType: body.jobType,
        workMode: body.workMode,
        salaryMin: body.salaryMin ?? null,
        salaryMax: body.salaryMax ?? null,
        salaryCurrency: body.salaryCurrency ?? 'DOP',
        salaryPeriod: body.salaryPeriod ?? null,
        applicationUrl: body.applicationUrl || null,
        applicationEmail: body.applicationEmail || null,
        contactWhatsapp: body.contactWhatsapp ? normalizePhone(body.contactWhatsapp) : null,
        status,
        sourceId,
        sourcePlatform: 'direct',
        dedupeKey: dedupeKey({ companyName, title: body.title, province, city }),
        contentHash: contentHash({ title: body.title, companyName, description, city, province }),
        publishedAt: status === 'published' ? now : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      .returning();

    await audit(req.user!.id, 'job.create', 'job', row!.id, { slug, status });
    if (status === 'published') {
      pingIndexNow([`/empleo/${slug}`, '/empleos']);
      void queueJobIndexing([slug], 'URL_UPDATED');
    }

    res.status(201).json({ id: row!.id, slug: row!.slug, status: row!.status });
  }),
);

const jobPatchSchema = jobInputSchema
  .innerType()
  .partial()
  .extend({ status: z.enum(['draft', 'published', 'closed']).optional() });

r.patch(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const body = jobPatchSchema.parse(req.body);
    const [existing] = await db.select().from(J).where(eq(J.id, req.params.id)).limit(1);
    if (!existing) throw new HttpError(404, 'Vacante no encontrada');
    const isAdmin = req.user!.role !== 'user';
    if (existing.postedByUserId !== req.user!.id && !isAdmin) {
      throw new HttpError(403, 'Solo quien publicó la vacante puede editarla');
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const assign = (k: keyof typeof body, col: string, transform?: (v: unknown) => unknown) => {
      if (body[k] !== undefined) patch[col] = transform ? transform(body[k]) : body[k] || null;
    };
    assign('title', 'title', (v) => (v as string).trim());
    assign('description', 'description', (v) => (v as string).trim());
    assign('requirements', 'requirements');
    assign('responsibilities', 'responsibilities');
    assign('category', 'category');
    assign('locationText', 'locationText');
    assign('streetAddress', 'streetAddress');
    assign('postalCode', 'postalCode');
    assign('jobType', 'jobType');
    assign('workMode', 'workMode');
    assign('salaryCurrency', 'salaryCurrency');
    assign('applicationUrl', 'applicationUrl');
    assign('applicationEmail', 'applicationEmail');
    if (body.salaryMin !== undefined) patch.salaryMin = body.salaryMin ?? null;
    if (body.salaryMax !== undefined) patch.salaryMax = body.salaryMax ?? null;
    if (body.salaryPeriod !== undefined) patch.salaryPeriod = body.salaryPeriod ?? null;
    if (body.contactWhatsapp !== undefined)
      patch.contactWhatsapp = body.contactWhatsapp ? normalizePhone(body.contactWhatsapp) : null;
    if (body.province !== undefined)
      patch.province = body.province && body.province !== 'todo-rd' ? body.province : null;
    if (body.city !== undefined) patch.city = canonicalCityName(body.city) ?? null;
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.status !== undefined) {
      patch.status = body.status;
      if (body.status === 'published' && !existing.publishedAt) patch.publishedAt = new Date();
    }

    // Recalcular hash / dedupeKey si cambió algo que los afecta.
    const nextTitle = (patch.title as string) ?? existing.title;
    const nextDesc = (patch.description as string) ?? existing.description;
    const nextCity = (patch.city as string | null) ?? existing.city;
    const nextProv = (patch.province as string | null) ?? existing.province;
    const materialChange =
      nextTitle !== existing.title || nextDesc !== existing.description || 'salaryMin' in patch;
    patch.dedupeKey = dedupeKey({
      companyName: existing.companyName,
      title: nextTitle,
      province: nextProv,
      city: nextCity,
    });
    patch.contentHash = contentHash({
      title: nextTitle,
      companyName: existing.companyName,
      description: nextDesc,
      city: nextCity,
      province: nextProv,
    });

    const [row] = await db.update(J).set(patch).where(eq(J.id, existing.id)).returning();
    await audit(req.user!.id, 'job.update', 'job', existing.id, Object.keys(patch));

    const nowPublished = row!.status === 'published';
    const wasGone = existing.status !== 'published' && nowPublished;
    if (nowPublished && (materialChange || wasGone)) {
      pingIndexNow([`/empleo/${row!.slug}`]);
      void queueJobIndexing([row!.slug], 'URL_UPDATED');
    } else if (!nowPublished && existing.status === 'published') {
      void queueJobIndexing([row!.slug], 'URL_DELETED');
    }
    res.json({ id: row!.id, slug: row!.slug, status: row!.status });
  }),
);

/** Cierre lógico (sale del directorio y de la indexación; conserva histórico). */
r.delete(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const [existing] = await db
      .select({ id: J.id, slug: J.slug, postedByUserId: J.postedByUserId, status: J.status })
      .from(J)
      .where(eq(J.id, req.params.id))
      .limit(1);
    if (!existing) throw new HttpError(404, 'Vacante no encontrada');
    const isAdmin = req.user!.role !== 'user';
    if (existing.postedByUserId !== req.user!.id && !isAdmin) throw new HttpError(403, 'No autorizado');
    await db
      .update(J)
      .set({ status: 'closed', updatedAt: new Date(), removedAt: new Date(), removedReason: 'owner' })
      .where(eq(J.id, existing.id));
    await audit(req.user!.id, 'job.close', 'job', existing.id, {});
    if (existing.status === 'published') void queueJobIndexing([existing.slug], 'URL_DELETED');
    res.json({ ok: true });
  }),
);

/** Reportar una vacante (spam / contenido inapropiado). */
r.post(
  '/:id/report',
  requireAuth,
  ah(async (req, res) => {
    const body = z
      .object({ reason: z.string().min(2).max(60), detail: z.string().max(1000).optional() })
      .parse(req.body);
    const [job] = await db.select({ id: J.id }).from(J).where(eq(J.id, req.params.id)).limit(1);
    if (!job) throw new HttpError(404, 'Vacante no encontrada');
    const [recent] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(jobReports)
      .where(
        and(
          eq(jobReports.reporterUserId, req.user!.id),
          gte(jobReports.createdAt, sql`now() - interval '24 hours'`),
        ),
      );
    if ((recent?.n ?? 0) >= 5) throw new HttpError(429, 'Demasiados reportes hoy');
    await db.insert(jobReports).values({
      jobId: job.id,
      reporterUserId: req.user!.id,
      reason: body.reason,
      detail: body.detail || null,
    });
    res.status(201).json({ ok: true });
  }),
);

/** Vacantes activas de una empresa por slug de nombre (landing `/empleos/empresa/:slug`). */
r.get(
  '/empresa/:slug',
  ah(async (req, res) => {
    const data = await getCompanyJobsBySlug(req.params.slug);
    if (!data) throw new HttpError(404, 'Empresa sin vacantes activas');
    res.json(data);
  }),
);

/** Detalle público — DEBE ir al final para no capturar `/facets` ni `/empresa`. */
r.get(
  '/:slug',
  ah(async (req, res) => {
    const result = await getJobForRender(req.params.slug);
    if (result.kind === 'notfound') throw new HttpError(404, 'Vacante no encontrada');
    if (result.kind === 'gone') {
      // 410 Gone: la URL existió, la oferta ya no. El cliente muestra la "lápida".
      res.status(410).json({
        gone: true,
        slug: result.row.slug,
        title: result.row.title,
        category: result.row.category,
        status: result.row.status,
        related: result.related.map(toJobCard),
      });
      return;
    }
    res.json(toJobDetail(result.row, result.related));
  }),
);

export default r;
