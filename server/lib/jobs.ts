import { and, desc, eq, gt, gte, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { jobs as J, profiles as P } from '../../shared/schema';
import { provinceName, isRealProvince } from '../../shared/provinces';
import { jobCategoryLabel, isJobCategory } from '../../shared/job-categories';
import {
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
  JOB_TYPE_VALUES,
  formatSalary,
  hasEnoughJobsForIndexing,
  jobSlug,
  normalizeText,
  type JobType,
  type WorkMode,
  type SalaryPeriod,
} from '../../shared/jobs';
import type { JobCard, JobDetail } from '../../shared/types';

type Row = typeof J.$inferSelect;

/** Genera un slug único para `/empleo/:slug` (reintenta con sufijo aleatorio). */
export async function generateUniqueJobSlug(title: string, locationHint?: string | null): Promise<string> {
  const base = jobSlug(title, locationHint);
  for (let i = 0; i < 40; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const [taken] = await db.select({ id: J.id }).from(J).where(eq(J.slug, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Mapea el "employment type" de una fuente a nuestro enum `job_type`. */
export function mapJobType(raw: string | null | undefined): JobType {
  const t = (raw || '').toLowerCase();
  if (/part|medio tiempo|media jornada/.test(t)) return 'part_time';
  if (/intern|pasant|practic|trainee/.test(t)) return 'internship';
  if (/tempor|estacional|seasonal/.test(t)) return 'temporary';
  if (/freelance|independiente|por proyecto/.test(t)) return 'freelance';
  if (/contract|contrato|obra/.test(t)) return 'contract';
  if (JOB_TYPE_VALUES.includes(t as JobType)) return t as JobType;
  return 'full_time';
}

const iso = (d: Date | string | null): string | null => (d ? new Date(d).toISOString() : null);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function toJobCard(r: Row): JobCard {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    companyId: r.companyId,
    companyName: r.companyName,
    category: r.category,
    categoryName: jobCategoryLabel(r.category) || 'Empleos',
    province: r.province,
    provinceName: r.province ? provinceName(r.province) || null : null,
    city: r.city,
    jobType: r.jobType,
    jobTypeLabel: JOB_TYPE_LABELS[r.jobType as JobType] ?? r.jobType,
    workMode: r.workMode,
    workModeLabel: WORK_MODE_LABELS[r.workMode as WorkMode] ?? r.workMode,
    salaryLabel: formatSalary({
      min: num(r.salaryMin),
      max: num(r.salaryMax),
      currency: r.salaryCurrency,
      period: r.salaryPeriod as SalaryPeriod | null,
    }),
    isFeatured: r.isFeatured,
    publishedAt: iso(r.publishedAt),
  };
}

export function toJobDetail(r: Row, related: Row[]): JobDetail {
  return {
    ...toJobCard(r),
    description: r.description,
    requirements: r.requirements,
    responsibilities: r.responsibilities,
    locationText: r.locationText,
    streetAddress: r.streetAddress,
    postalCode: r.postalCode,
    salaryMin: num(r.salaryMin),
    salaryMax: num(r.salaryMax),
    salaryCurrency: r.salaryCurrency,
    salaryPeriod: r.salaryPeriod,
    applicationUrl: r.applicationUrl,
    applicationEmail: r.applicationEmail,
    contactWhatsapp: r.contactWhatsapp,
    directApply: r.directApply,
    status: r.status,
    publishedAt: iso(r.publishedAt),
    updatedAt: iso(r.updatedAt),
    expiresAt: iso(r.expiresAt),
    createdAt: iso(r.createdAt)!,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    sourcePlatform: r.sourcePlatform,
    related: related.map(toJobCard),
  };
}

/** Vacante para SEO/JSON-LD (`shared/seo.ts` `JobSeoInput`). */
export function toJobSeoInput(r: Row) {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    companyId: r.companyId,
    companyName: r.companyName,
    category: r.category,
    province: r.province,
    provinceName: r.province ? provinceName(r.province) || null : null,
    city: r.city,
    jobType: r.jobType,
    workMode: r.workMode,
    salaryMin: num(r.salaryMin),
    salaryMax: num(r.salaryMax),
    salaryCurrency: r.salaryCurrency,
    salaryPeriod: r.salaryPeriod,
    publishedAt: iso(r.publishedAt),
    expiresAt: iso(r.expiresAt),
    streetAddress: r.streetAddress,
    postalCode: r.postalCode,
    applyUrl: r.applicationUrl,
    directApply: r.directApply,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    status: r.status,
  };
}

/** Condición de "visible al público": publicado y sin expirar. */
const visibleCond = () =>
  and(eq(J.status, 'published'), or(isNull(J.expiresAt), gt(J.expiresAt, sql`now()`)));

export interface JobFilters {
  q?: string;
  category?: string;
  province?: string;
  city?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  companyId?: string;
  cursor?: string | null;
  limit?: number;
}

function encodeCursor(publishedAt: string | null, id: string): string {
  return Buffer.from(`${publishedAt ?? ''}|${id}`).toString('base64url');
}
function decodeCursor(c: string): { publishedAt: string; id: string } | null {
  try {
    const [publishedAt, id] = Buffer.from(c, 'base64url').toString('utf8').split('|');
    if (!id) return null;
    return { publishedAt, id };
  } catch {
    return null;
  }
}

/**
 * Búsqueda + filtros + paginación keyset. Orden: publishedAt DESC, id DESC
 * (los destacados se marcan en la tarjeta, no se reordenan globalmente → keyset simple).
 */
export async function listJobs(f: JobFilters): Promise<{ items: JobCard[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(f.limit ?? 20, 1), 50);
  const q = (f.q ?? '').trim();
  const cur = f.cursor ? decodeCursor(f.cursor) : null;

  const rows = await db
    .select()
    .from(J)
    .where(
      and(
        visibleCond(),
        f.companyId ? eq(J.companyId, f.companyId) : undefined,
        isJobCategory(f.category) ? eq(J.category, f.category!) : undefined,
        isRealProvince(f.province) ? eq(J.province, f.province!) : undefined,
        f.city ? eq(J.city, f.city) : undefined,
        f.workMode ? eq(J.workMode, f.workMode as WorkMode) : undefined,
        f.jobType ? eq(J.jobType, f.jobType as JobType) : undefined,
        f.salaryMin && f.salaryMin > 0 ? gte(J.salaryMax, f.salaryMin) : undefined,
        q
          ? or(
              sql`${J.title} ilike ${`%${q}%`}`,
              sql`${J.companyName} ilike ${`%${q}%`}`,
              q.length >= 4 ? sql`${J.description} ilike ${`%${q}%`}` : undefined,
            )
          : undefined,
        cur
          ? sql`(${J.publishedAt}, ${J.id}) < (${cur.publishedAt}::timestamptz, ${cur.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(J.publishedAt), desc(J.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toJobCard),
    nextCursor: hasMore && last ? encodeCursor(iso(last.publishedAt), last.id) : null,
  };
}

/** 6 vacantes activas relacionadas por categoría o provincia. */
async function relatedJobs(row: Row): Promise<Row[]> {
  return db
    .select()
    .from(J)
    .where(
      and(
        visibleCond(),
        ne(J.id, row.id),
        row.province
          ? or(eq(J.category, row.category), eq(J.province, row.province))
          : eq(J.category, row.category),
      ),
    )
    .orderBy(desc(J.publishedAt))
    .limit(6);
}

const PUBLIC_VISIBLE = (row: Row) =>
  row.status === 'published' &&
  !(row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now());

/** Estados que muestran "lápida" 410 (la URL se conserva, sin JobPosting). */
export const GONE_STATUSES = new Set(['expired', 'removed', 'closed']);

export async function getJobBySlug(slug: string): Promise<JobDetail | null> {
  const [row] = await db.select().from(J).where(eq(J.slug, slug)).limit(1);
  if (!row || !PUBLIC_VISIBLE(row)) return null;
  return toJobDetail(row, await relatedJobs(row));
}

export type JobRenderResult =
  | { kind: 'ok'; row: Row; related: Row[] }
  | { kind: 'gone'; row: Row; related: Row[] }
  | { kind: 'notfound' };

/**
 * Para el SSR: resuelve una vacante por slug con TODOS los estados.
 *  - `ok`       → publicada y vigente → render normal + JobPosting.
 *  - `gone`     → expirada / retirada / cerrada → lápida HTTP 410, sin JobPosting.
 *  - `notfound` → no existe, o borrador / pendiente / posible-duplicado (nunca fue pública).
 */
export async function getJobForRender(slug: string): Promise<JobRenderResult> {
  const [row] = await db.select().from(J).where(eq(J.slug, slug)).limit(1);
  if (!row) return { kind: 'notfound' };
  if (PUBLIC_VISIBLE(row)) return { kind: 'ok', row, related: await relatedJobs(row) };
  const goneByExpiry = row.status === 'published' && !!row.expiresAt;
  if (GONE_STATUSES.has(row.status) || goneByExpiry) {
    return { kind: 'gone', row, related: await relatedJobs(row) };
  }
  return { kind: 'notfound' };
}

/** Slug estable a partir del nombre de una empresa (para `/empleos/empresa/:slug`). */
export function companySlugify(name: string): string {
  return normalizeText(name).replace(/\s+/g, '-').slice(0, 80) || 'empresa';
}

/** Empleos activos de una empresa por su slug de nombre (para la landing de empresa). */
export async function getCompanyJobsBySlug(
  slug: string,
): Promise<{ companyName: string; province: string | null; jobs: JobCard[] } | null> {
  const rows = await db
    .select()
    .from(J)
    .where(visibleCond())
    .orderBy(desc(J.publishedAt))
    .limit(500);
  const match = rows.filter((r) => companySlugify(r.companyName) === slug);
  if (!match.length) return null;
  return {
    companyName: match[0]!.companyName,
    province: match[0]!.province,
    jobs: match.map(toJobCard),
  };
}

/** Empleos activos de un negocio (para su ficha `/p/:id`). */
export async function jobsForCompany(companyId: string, limit = 8): Promise<JobCard[]> {
  const rows = await db
    .select()
    .from(J)
    .where(and(visibleCond(), eq(J.companyId, companyId)))
    .orderBy(desc(J.publishedAt))
    .limit(limit);
  return rows.map(toJobCard);
}

/** Conteos por categoría y provincia (para filtros + guard de indexación). */
export async function jobFacetCounts(): Promise<{
  byCategory: Record<string, { active: number; companies: number; newest: string | null }>;
  byProvince: Record<string, { active: number; companies: number; newest: string | null }>;
}> {
  const cat = await db
    .select({
      k: J.category,
      active: sql<number>`count(*)::int`,
      companies: sql<number>`count(distinct coalesce(${J.companyId}::text, ${J.companyName}))::int`,
      newest: sql<string | null>`max(${J.publishedAt})`,
    })
    .from(J)
    .where(visibleCond())
    .groupBy(J.category);
  const prov = await db
    .select({
      k: J.province,
      active: sql<number>`count(*)::int`,
      companies: sql<number>`count(distinct coalesce(${J.companyId}::text, ${J.companyName}))::int`,
      newest: sql<string | null>`max(${J.publishedAt})`,
    })
    .from(J)
    .where(and(visibleCond(), sql`${J.province} is not null`))
    .groupBy(J.province);

  const mk = (rows: { k: string | null; active: number; companies: number; newest: string | null }[]) =>
    Object.fromEntries(
      rows
        .filter((r) => r.k)
        .map((r) => [r.k as string, { active: r.active, companies: r.companies, newest: r.newest }]),
    );
  return { byCategory: mk(cat), byProvince: mk(prov) };
}

/** ¿Es indexable la landing de esa combinación? (usa `hasEnoughJobsForIndexing`). */
export function landingIndexable(
  facets: Awaited<ReturnType<typeof jobFacetCounts>>,
  categorySlug?: string | null,
  provinceSlug?: string | null,
): { indexable: boolean; count: number } {
  let stats: { active: number; companies: number; newest: string | null } | undefined;
  if (categorySlug && provinceSlug) {
    // combinación: aproximamos con el menor de los dos (el conteo real se calcula en SSR si hace falta)
    const c = facets.byCategory[categorySlug];
    const p = facets.byProvince[provinceSlug];
    if (!c || !p) return { indexable: false, count: 0 };
    stats = { active: Math.min(c.active, p.active), companies: Math.min(c.companies, p.companies), newest: c.newest };
  } else if (categorySlug) {
    stats = facets.byCategory[categorySlug];
  } else if (provinceSlug) {
    stats = facets.byProvince[provinceSlug];
  }
  if (!stats) return { indexable: false, count: 0 };
  return {
    indexable: hasEnoughJobsForIndexing({
      activeCount: stats.active,
      distinctCompanies: stats.companies,
      newestPublishedAt: stats.newest,
    }),
    count: stats.active,
  };
}

/**
 * Marca como `expired` los empleos publicados cuya fecha de expiración ya pasó y
 * pide a Google que despublique sus URLs. Devuelve los slugs afectados para que el
 * llamador (cron) los registre.
 */
export async function expireStaleJobs(): Promise<{ expired: string[] }> {
  const rows = await db
    .update(J)
    .set({ status: 'expired', updatedAt: new Date(), removedAt: new Date(), removedReason: 'expired' })
    .where(and(eq(J.status, 'published'), sql`${J.expiresAt} is not null`, lt(J.expiresAt, sql`now()`)))
    .returning({ slug: J.slug });
  const expired = rows.map((r) => r.slug);
  if (expired.length) {
    const { queueJobIndexing } = await import('./googleIndexing');
    await queueJobIndexing(expired, 'URL_DELETED').catch(() => {});
  }
  return { expired };
}

let lastExpireRun = 0;
/** Respaldo perezoso si no hay cron: corre `expireStaleJobs` como mucho 1×/hora. */
export async function maybeExpireJobs(): Promise<void> {
  if (Date.now() - lastExpireRun < 3_600_000) return;
  lastExpireRun = Date.now();
  try {
    await expireStaleJobs();
  } catch {
    /* silencioso */
  }
}
