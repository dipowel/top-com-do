/**
 * Pipeline de importación: fuente → normalizar → deduplicar (5 niveles) → moderar →
 * publicar. Cada corrida queda registrada en `job_import_runs`.
 *
 * Acotado en tiempo: cada `runSource` tiene un presupuesto de ~20 s y un tope de
 * ofertas, para no chocar con el límite de 30 s de la función serverless de Vercel.
 * `runDueSources` reparte el presupuesto entre las fuentes que toca refrescar.
 */
import { and, eq, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { jobs as J, jobSources as S, jobImportRuns as R } from '../../shared/schema';
import type { JobSource } from '../../shared/schema';
import { sanitizePlainText, sanitizeRichText, isSafeUrl } from '../../shared/sanitize';
import { dedupeKey, type JobType } from '../../shared/jobs';
import {
  contentHash,
  detectWorkMode,
  mapSourceCategory,
  normalizeLocation,
} from '../../shared/job-normalize';
import { generateUniqueJobSlug, mapJobType } from './jobs';
import { buildAdapter, hasAdapter, importEnabled } from '../adapters/registry';
import type { ImportContext, RawJob } from '../adapters/types';
import { SourceNotAuthorizedError } from '../adapters/types';
import { queueJobIndexing } from './googleIndexing';
import { pingIndexNow } from './indexnow';

const RUN_BUDGET_MS = 20_000;
const MAX_JOBS_PER_RUN = 150;
/** Cada cuánto se vuelve a consultar una fuente. */
const REFRESH_EVERY_MS = 5.5 * 60 * 60 * 1000;
/** Gracia antes de dar por "retirada" una oferta que ya no aparece en la fuente. */
const REMOVAL_GRACE_MS = 48 * 60 * 60 * 1000;

export interface RunResult {
  platform: string;
  status: 'ok' | 'error';
  found: number;
  created: number;
  updated: number;
  duplicate: number;
  removed: number;
  failed: number;
  error?: string;
}

interface NormJob {
  sourceJobId: string;
  sourceUrl: string | null;
  title: string;
  companyName: string;
  description: string;
  descriptionPlain: string;
  requirements: string | null;
  responsibilities: string | null;
  category: string;
  province: string | null;
  city: string | null;
  locationText: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  jobType: JobType;
  workMode: 'onsite' | 'hybrid' | 'remote';
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  applicationUrl: string | null;
  applicationEmail: string | null;
  directApply: boolean;
  publishedAt: Date | null;
  expiresAt: Date | null;
  companyLogo: string | null;
  dedupeKey: string;
  contentHash: string;
  raw: unknown;
}

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const numOrNull = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

function normalizeRawJob(raw: RawJob, source: JobSource): NormJob | null {
  const title = sanitizePlainText(raw.title).slice(0, 140);
  const companyName = sanitizePlainText(raw.companyName).slice(0, 120) || sanitizePlainText(source.name);
  if (title.length < 3 || !companyName) return null;

  const description = sanitizeRichText(raw.description).slice(0, 12_000);
  const descriptionPlain = sanitizePlainText(raw.description);
  const { province, city } = normalizeLocation({
    province: raw.province,
    city: raw.city,
    locationText: raw.locationText,
  });
  const applicationUrl = isSafeUrl(raw.applyUrl) ? raw.applyUrl!.trim() : null;
  const applicationEmail =
    raw.applyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.applyEmail) ? raw.applyEmail.trim() : null;

  return {
    sourceJobId: String(raw.sourceJobId).slice(0, 200),
    sourceUrl: isSafeUrl(raw.sourceUrl) ? raw.sourceUrl!.trim() : null,
    title,
    companyName,
    description,
    descriptionPlain,
    requirements: sanitizePlainText(raw.requirements) || null,
    responsibilities: sanitizePlainText(raw.responsibilities) || null,
    category: mapSourceCategory(raw.category, source.defaultCategory ?? 'otros'),
    province,
    city,
    locationText: sanitizePlainText(raw.locationText) || null,
    streetAddress: sanitizePlainText(raw.streetAddress).slice(0, 160) || null,
    postalCode: sanitizePlainText(raw.postalCode).slice(0, 12) || null,
    jobType: mapJobType(raw.employmentType),
    workMode: detectWorkMode(raw.workModeText, raw.locationText, descriptionPlain),
    salaryMin: numOrNull(raw.salaryMin),
    salaryMax: numOrNull(raw.salaryMax),
    salaryCurrency: (raw.salaryCurrency || 'DOP').toUpperCase().slice(0, 3),
    salaryPeriod: raw.salaryPeriod || null,
    applicationUrl,
    applicationEmail,
    directApply: raw.directApply === true && applicationUrl != null,
    publishedAt: parseDate(raw.publishedAt),
    expiresAt: parseDate(raw.expiresAt),
    companyLogo: isSafeUrl(raw.companyLogo) ? raw.companyLogo!.trim() : null,
    dedupeKey: dedupeKey({ companyName, title, province, city }),
    contentHash: contentHash({ title, companyName, description: descriptionPlain, city, province }),
    raw: raw.raw ?? raw,
  };
}

let trigramOk: boolean | null = null;
async function similarExists(n: NormJob): Promise<boolean> {
  if (trigramOk === false) return false;
  try {
    const rows = await db.execute(sql`
      select 1 from ${J}
      where ${J.province} is not distinct from ${n.province}
        and lower(${J.companyName}) = ${n.companyName.toLowerCase()}
        and similarity(lower(${J.title}), ${n.title.toLowerCase()}) > 0.6
        and ${J.status} in ('published','pending_review')
      limit 1
    `);
    trigramOk = true;
    return (rows.rows?.length ?? (rows as unknown as unknown[]).length ?? 0) > 0;
  } catch {
    trigramOk = false; // pg_trgm no disponible → se omite N5
    return false;
  }
}

/** Deduplicación 5 niveles. Devuelve la acción a tomar. */
async function classify(
  n: NormJob,
  platform: string,
): Promise<{ action: 'update'; id: string } | { action: 'duplicate'; ofId: string } | { action: 'new' }> {
  // N2: mismo (plataforma, id de la fuente) → es la misma oferta.
  const [byKey] = await db
    .select({ id: J.id })
    .from(J)
    .where(and(eq(J.sourcePlatform, platform), eq(J.sourceJobId, n.sourceJobId)))
    .limit(1);
  if (byKey) return { action: 'update', id: byKey.id };

  // N1: misma URL de origen (aunque cambie el id).
  if (n.sourceUrl) {
    const [byUrl] = await db.select({ id: J.id }).from(J).where(eq(J.sourceUrl, n.sourceUrl)).limit(1);
    if (byUrl) return { action: 'update', id: byUrl.id };
  }

  // N3: empresa+título+ubicación normalizados (otra fuente).
  const [byDedupe] = await db
    .select({ id: J.id })
    .from(J)
    .where(and(eq(J.dedupeKey, n.dedupeKey), ne(J.sourcePlatform, platform)))
    .limit(1);
  if (byDedupe) return { action: 'duplicate', ofId: byDedupe.id };

  // N4: mismo hash de contenido (otra fuente).
  const [byHash] = await db
    .select({ id: J.id })
    .from(J)
    .where(and(eq(J.contentHash, n.contentHash), ne(J.sourcePlatform, platform)))
    .limit(1);
  if (byHash) return { action: 'duplicate', ofId: byHash.id };

  // N5: similitud alta (misma empresa/provincia, título ~igual).
  if (await similarExists(n)) {
    const [any] = await db
      .select({ id: J.id })
      .from(J)
      .where(and(eq(J.dedupeKey, n.dedupeKey)))
      .limit(1);
    return { action: 'duplicate', ofId: any?.id ?? n.sourceJobId };
  }

  return { action: 'new' };
}

/** Importa las ofertas de UNA fuente. */
export async function runSource(source: JobSource, budgetMs = RUN_BUDGET_MS): Promise<RunResult> {
  const result: RunResult = {
    platform: source.platform,
    status: 'ok',
    found: 0,
    created: 0,
    updated: 0,
    duplicate: 0,
    removed: 0,
    failed: 0,
  };
  const [run] = await db
    .insert(R)
    .values({ sourceId: source.id, sourcePlatform: source.platform, status: 'running' })
    .returning({ id: R.id });
  await db.update(S).set({ lastRunStatus: 'running', lastRunAt: new Date() }).where(eq(S.id, source.id));

  const ctx: ImportContext = { maxJobs: MAX_JOBS_PER_RUN, deadline: Date.now() + budgetMs };
  const seenSourceIds: string[] = [];
  const publishedSlugs: string[] = [];

  try {
    const adapter = buildAdapter(source);
    for await (const raw of adapter.fetchJobs(ctx)) {
      result.found++;
      const n = normalizeRawJob(raw, source);
      if (!n) {
        result.failed++;
        continue;
      }
      seenSourceIds.push(n.sourceJobId);
      try {
        const cls = await classify(n, source.platform);
        if (cls.action === 'update') {
          await db
            .update(J)
            .set({
              title: n.title,
              description: n.description,
              requirements: n.requirements,
              responsibilities: n.responsibilities,
              category: n.category,
              province: n.province,
              city: n.city,
              locationText: n.locationText,
              streetAddress: n.streetAddress,
              postalCode: n.postalCode,
              jobType: n.jobType,
              workMode: n.workMode,
              salaryMin: n.salaryMin,
              salaryMax: n.salaryMax,
              salaryCurrency: n.salaryCurrency,
              salaryPeriod: n.salaryPeriod as never,
              applicationUrl: n.applicationUrl,
              applicationEmail: n.applicationEmail,
              directApply: n.directApply,
              sourceUrl: n.sourceUrl,
              expiresAt: n.expiresAt,
              lastSeenAt: new Date(),
              contentHash: n.contentHash,
              dedupeKey: n.dedupeKey,
              rawPayload: n.raw as never,
              // `updatedAt` (y con ello el lastmod del sitemap) SOLO si cambió el contenido.
              updatedAt: sql`case when ${J.contentHash} is distinct from ${n.contentHash} then now() else ${J.updatedAt} end`,
            })
            .where(eq(J.id, cls.id));
          result.updated++;
        } else if (cls.action === 'duplicate') {
          const [existingDup] = await db
            .select({ id: J.id })
            .from(J)
            .where(and(eq(J.sourcePlatform, source.platform), eq(J.sourceJobId, n.sourceJobId)))
            .limit(1);
          if (!existingDup) {
            await insertJob(n, source, 'possible_duplicate', cls.ofId);
          }
          result.duplicate++;
        } else {
          const status = source.autoPublish ? 'published' : 'pending_review';
          const slug = await insertJob(n, source, status);
          if (status === 'published') publishedSlugs.push(slug);
          result.created++;
        }
      } catch (e) {
        result.failed++;
        console.warn('[import] fallo procesando oferta', n.sourceJobId, (e as Error).message);
      }
    }

    // Retirada: ofertas de esta fuente que ya no aparecen y llevan tiempo sin verse.
    if (seenSourceIds.length) {
      const gone = await db
        .update(J)
        .set({ status: 'removed', removedAt: new Date(), removedReason: 'gone_from_source', updatedAt: new Date() })
        .where(
          and(
            eq(J.sourcePlatform, source.platform),
            eq(J.status, 'published'),
            notInArray(J.sourceJobId, seenSourceIds),
            sql`${J.lastSeenAt} < now() - ${sql.raw(`interval '${Math.round(REMOVAL_GRACE_MS / 3600000)} hours'`)}`,
          ),
        )
        .returning({ slug: J.slug });
      result.removed = gone.length;
      if (gone.length) await queueJobIndexing(gone.map((g) => g.slug), 'URL_DELETED');
    }

    if (publishedSlugs.length) {
      pingIndexNow([...publishedSlugs.map((s) => `/empleo/${s}`), '/empleos']);
      await queueJobIndexing(publishedSlugs, 'URL_UPDATED');
    }
  } catch (e) {
    result.status = 'error';
    result.error = (e as Error).message;
    if (!(e instanceof SourceNotAuthorizedError)) {
      console.error('[import] fuente', source.platform, 'falló:', e);
    }
  }

  await db
    .update(R)
    .set({
      status: result.status,
      finishedAt: new Date(),
      jobsFound: result.found,
      jobsNew: result.created,
      jobsUpdated: result.updated,
      jobsDuplicate: result.duplicate,
      jobsRemoved: result.removed,
      jobsFailed: result.failed,
      error: result.error ?? null,
    })
    .where(eq(R.id, run!.id));
  await db
    .update(S)
    .set({ lastRunStatus: result.status, lastError: result.error ?? null, updatedAt: new Date() })
    .where(eq(S.id, source.id));

  return result;
}

async function insertJob(
  n: NormJob,
  source: JobSource,
  status: 'published' | 'pending_review' | 'possible_duplicate',
  duplicateOfId?: string,
): Promise<string> {
  const slug = await generateUniqueJobSlug(n.title, n.city || n.province);
  const now = new Date();
  await db.insert(J).values({
    slug,
    title: n.title,
    description: n.description || n.descriptionPlain || n.title,
    requirements: n.requirements,
    responsibilities: n.responsibilities,
    companyName: n.companyName,
    postedByUserId: null, // vacante importada: sin persona que la publicó
    category: n.category,
    province: n.province,
    city: n.city,
    locationText: n.locationText,
    streetAddress: n.streetAddress,
    postalCode: n.postalCode,
    jobType: n.jobType,
    workMode: n.workMode,
    salaryMin: n.salaryMin,
    salaryMax: n.salaryMax,
    salaryCurrency: n.salaryCurrency,
    salaryPeriod: n.salaryPeriod as never,
    applicationUrl: n.applicationUrl,
    applicationEmail: n.applicationEmail,
    directApply: n.directApply,
    status,
    sourceId: source.id,
    sourcePlatform: source.platform,
    sourceName: source.name,
    sourceUrl: n.sourceUrl,
    sourceJobId: n.sourceJobId,
    dedupeKey: n.dedupeKey,
    contentHash: n.contentHash,
    duplicateOfId: duplicateOfId && /^[0-9a-f-]{36}$/i.test(duplicateOfId) ? duplicateOfId : null,
    rawPayload: n.raw as never,
    publishedAt: status === 'published' ? n.publishedAt || now : null,
    firstSeenAt: now,
    lastSeenAt: now,
    expiresAt: n.expiresAt,
  });
  return slug;
}

/** Corre las fuentes que toca refrescar, repartiendo el presupuesto de tiempo. */
export async function runDueSources(): Promise<RunResult[]> {
  if (!importEnabled()) return [];
  const sources = await db
    .select()
    .from(S)
    .where(and(eq(S.isEnabled, true), eq(S.authorizationStatus, 'authorized'), ne(S.platform, 'direct')));

  const due = sources.filter(
    (s) => hasAdapter(s.platform) && (!s.lastRunAt || Date.now() - new Date(s.lastRunAt).getTime() > REFRESH_EVERY_MS),
  );
  if (!due.length) return [];

  const perSource = Math.max(6_000, Math.floor((RUN_BUDGET_MS * 1.2) / due.length));
  const out: RunResult[] = [];
  const overallDeadline = Date.now() + 24_000;
  for (const s of due) {
    if (Date.now() > overallDeadline) break;
    out.push(await runSource(s, perSource));
  }
  return out;
}
