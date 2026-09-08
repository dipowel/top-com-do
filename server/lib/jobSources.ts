/**
 * Arquitectura de FUENTES de empleos. Hoy la única fuente real y autorizada es la
 * publicación directa de empresas (`direct`), cuyas ofertas entran por
 * `POST /api/jobs` (no por un `fetchJobs`). Cualquier fuente externa (portales,
 * feeds, APIs) queda deshabilitada hasta que exista base legítima para usarla:
 * NO se hace scraping.
 *
 * Para añadir una fuente autorizada en el futuro:
 *   1. Insertar una fila en `job_sources` con `authorization_status='authorized'`,
 *      `is_enabled=true` y el `platform` correspondiente.
 *   2. Implementar un adaptador `JobSourceAdapter` y registrarlo en `JOB_SOURCE_ADAPTERS`.
 *   3. `runEnabledSources()` lo recogerá: fetch → normalize → validate → dedupe → upsert.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { jobSources } from '../../shared/schema';

export interface RawJob {
  sourceJobId: string;
  sourceUrl?: string;
  title: string;
  description: string;
  companyName: string;
  category?: string;
  province?: string;
  city?: string;
  jobType?: string;
  workMode?: string;
  salaryMin?: number;
  salaryMax?: number;
  applicationUrl?: string;
  publishedAt?: string;
  expiresAt?: string;
}

export interface JobSourceAdapter {
  readonly platform: string;
  /** Lanza si la fuente no está autorizada/habilitada. */
  fetchJobs(): Promise<RawJob[]>;
}

/** Fuente "publicación directa": no hace fetch — las ofertas llegan por el endpoint. */
export class DirectCompanySource implements JobSourceAdapter {
  readonly platform = 'direct';
  async fetchJobs(): Promise<RawJob[]> {
    return [];
  }
}

/** Registro de adaptadores. Solo `direct` está implementado. */
export const JOB_SOURCE_ADAPTERS: Record<string, () => JobSourceAdapter> = {
  direct: () => new DirectCompanySource(),
};

/** Garantiza que exista la fila de la fuente "direct" (idempotente). */
export async function ensureDirectSource(): Promise<string> {
  const [existing] = await db
    .select({ id: jobSources.id })
    .from(jobSources)
    .where(eq(jobSources.platform, 'direct'))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(jobSources)
    .values({
      name: 'Publicación directa',
      platform: 'direct',
      sourceType: 'direct',
      authorizationStatus: 'authorized',
      isEnabled: true,
    })
    .onConflictDoNothing({ target: jobSources.platform })
    .returning({ id: jobSources.id });
  if (row) return row.id;
  const [again] = await db
    .select({ id: jobSources.id })
    .from(jobSources)
    .where(eq(jobSources.platform, 'direct'))
    .limit(1);
  return again!.id;
}

/**
 * Recorre las fuentes habilitadas Y autorizadas y ejecuta su adaptador. Hoy es
 * un no-op efectivo: solo `direct` está habilitada y su `fetchJobs` devuelve `[]`.
 */
export async function runEnabledSources(): Promise<{ platform: string; ingested: number }[]> {
  const sources = await db
    .select()
    .from(jobSources)
    .where(and(eq(jobSources.isEnabled, true), eq(jobSources.authorizationStatus, 'authorized')));

  const results: { platform: string; ingested: number }[] = [];
  for (const s of sources) {
    const make = JOB_SOURCE_ADAPTERS[s.platform];
    if (!make) {
      results.push({ platform: s.platform, ingested: 0 }); // sin adaptador → se salta
      continue;
    }
    try {
      const raw = await make().fetchJobs();
      // TODO(cuando haya una fuente real): normalize → validate → dedupe → upsert.
      results.push({ platform: s.platform, ingested: raw.length });
      await db
        .update(jobSources)
        .set({ lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(jobSources.id, s.id));
    } catch {
      results.push({ platform: s.platform, ingested: 0 });
    }
  }
  return results;
}
