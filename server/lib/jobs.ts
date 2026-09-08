import { and, desc, eq, gt, gte, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { jobs as J, profiles as P } from '../../shared/schema';
import { provinceName, isRealProvince } from '../../shared/provinces';
import { jobCategoryLabel, isJobCategory } from '../../shared/job-categories';
import {
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
  formatSalary,
  hasEnoughJobsForIndexing,
  type JobType,
  type WorkMode,
  type SalaryPeriod,
} from '../../shared/jobs';
import type { JobCard, JobDetail } from '../../shared/types';

type Row = typeof J.$inferSelect;

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
    salaryMin: num(r.salaryMin),
    salaryMax: num(r.salaryMax),
    salaryCurrency: r.salaryCurrency,
    salaryPeriod: r.salaryPeriod,
    applicationUrl: r.applicationUrl,
    applicationEmail: r.applicationEmail,
    contactWhatsapp: r.contactWhatsapp,
    status: r.status,
    expiresAt: iso(r.expiresAt),
    createdAt: iso(r.createdAt)!,
    related: related.map(toJobCard),
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

export async function getJobBySlug(slug: string): Promise<JobDetail | null> {
  const [row] = await db.select().from(J).where(eq(J.slug, slug)).limit(1);
  if (!row || row.status !== 'published') return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

  const related = await db
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

  return toJobDetail(row, related);
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

/** Marca como `expired` los empleos publicados cuya fecha de expiración ya pasó. */
export async function expireStaleJobs(): Promise<number> {
  const res = await db
    .update(J)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(J.status, 'published'), sql`${J.expiresAt} is not null`, lt(J.expiresAt, sql`now()`)))
    .returning({ id: J.id });
  return res.length;
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
