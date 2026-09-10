/**
 * Jooble API — https://jooble.org/api/about
 * REQUIERE registrarse como publisher y recibir una API key. La key va SOLO en el
 * servidor (`JOOBLE_API_KEY`). Sin key + sin fila `job_sources` autorizada, este
 * adaptador NO se ejecuta.
 *
 * Alcance de uso: Jooble entrega resultados de búsqueda con enlace a la oferta.
 * Se re-publican con canonical propio a Top y `directApply` NO (el enlace lleva a
 * Jooble / al portal de origen). Antes de habilitar, revisa los términos de la API
 * de Jooble para tu caso de uso.
 *
 * Este adaptador usa el índice de RD (`do.jooble.org`), filtra ESTRICTAMENTE a
 * ubicaciones dominicanas y descarta avisos "thin content". Sus vacantes SIEMPRE
 * entran como `pending_review` (ver `CURATED_ONLY` en `server/lib/jobImport.ts`).
 */
import type { ImportContext, JobSourceAdapter, RawJob, SourceConfig } from './types';
import { SourceNotAuthorizedError } from './types';
import { isDominicanLocation } from '../../shared/job-normalize';
import type { JobSource } from '../../shared/schema';

/** Índice del sitio de RD de Jooble (el endpoint del ejemplo oficial del publisher). */
const JOOBLE_DR_HOST = 'https://do.jooble.org/api/';
/** Descripción mínima para no indexar avisos "thin content" que dañan el SEO. */
const MIN_SNIPPET_LEN = 120;

interface JoobleJob {
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string;
  id: number;
}

export class JoobleAdapter implements JobSourceAdapter {
  readonly platform: string;
  readonly displayName: string;
  readonly kind = 'search' as const;
  private key: string;
  private queries: { keywords: string; location?: string }[];

  constructor(source: JobSource) {
    const key = process.env.JOOBLE_API_KEY;
    if (!key) throw new SourceNotAuthorizedError(source.platform, 'falta JOOBLE_API_KEY (registro de publisher en Jooble)');
    if (source.authorizationStatus !== 'authorized') {
      throw new SourceNotAuthorizedError(source.platform, "job_sources.authorization_status debe ser 'authorized'");
    }
    const cfg = (source.config ?? {}) as SourceConfig;
    this.key = key;
    this.queries = (
      cfg.joobleQueries?.length ? cfg.joobleQueries : [{ keywords: 'empleo' }]
    ).map((q) => ({ keywords: q.keywords, location: q.location || 'República Dominicana' }));
    this.platform = source.platform;
    this.displayName = source.name;
  }

  async *fetchJobs(ctx: ImportContext): AsyncIterable<RawJob> {
    let emitted = 0;
    for (const q of this.queries) {
      for (let page = 1; page <= 5; page++) {
        if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
        const res = await fetch(`${JOOBLE_DR_HOST}${this.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: q.keywords, location: q.location ?? '', page }),
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error(`Jooble: HTTP ${res.status}`);
        const body = (await res.json()) as { jobs?: JoobleJob[] };
        const jobs = body.jobs ?? [];
        if (!jobs.length) break;
        for (const j of jobs) {
          if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
          if (!j.company || !j.title) continue;
          // Filtro geográfico ESTRICTO: solo ofertas de la República Dominicana.
          if (!isDominicanLocation(j.location)) continue;
          // Guarda de calidad: descarta avisos con snippet demasiado corto (thin content).
          if ((j.snippet ?? '').trim().length < MIN_SNIPPET_LEN) continue;
          emitted++;
          yield {
            sourceJobId: String(j.id),
            sourceUrl: j.link,
            applyUrl: j.link,
            directApply: false,
            title: j.title,
            companyName: j.company,
            description: j.snippet ?? null,
            locationText: j.location ?? null,
            employmentType: j.type ?? null,
            salaryMin: null,
            salaryMax: null,
            updatedAt: j.updated ?? null,
            raw: j,
          };
        }
      }
    }
  }
}
