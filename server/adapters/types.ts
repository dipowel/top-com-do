/**
 * Contrato de las FUENTES de empleo. Cada adaptador sabe hablar con UNA plataforma
 * y entregar ofertas ya en forma de `RawJob`. El pipeline (`server/lib/jobImport.ts`)
 * se encarga de normalizar, deduplicar, moderar y publicar.
 *
 * Reglas duras:
 *  - Un adaptador NUNCA evade bloqueos, límites de IP ni mecanismos anti-bot.
 *  - Si la fuente no autoriza la extracción/reutilización → el adaptador lanza
 *    `SourceNotAuthorizedError` y no se ejecuta.
 *  - Dato que la fuente no aporta → `null`/omitido. Jamás se inventa.
 */
import type { JobSource } from '../../shared/schema';

export class SourceNotAuthorizedError extends Error {
  constructor(platform: string, detail: string) {
    super(`Fuente "${platform}" no autorizada: ${detail}`);
    this.name = 'SourceNotAuthorizedError';
  }
}

/** Oferta cruda tal como la entrega una fuente. Solo estos campos se consideran fiables. */
export interface RawJob {
  /** Identificador estable de la oferta EN la fuente (obligatorio para deduplicar). */
  sourceJobId: string;
  /** URL de la publicación original en la fuente. */
  sourceUrl?: string | null;
  title: string;
  companyName: string;
  /** URL o email de aplicación oficial. */
  applyUrl?: string | null;
  applyEmail?: string | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  locationText?: string | null;
  province?: string | null;
  city?: string | null;
  category?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  streetAddress?: string | null;
  postalCode?: string | null;
  employmentType?: string | null;
  workModeText?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  companyLogo?: string | null;
  /** true solo si la fuente confirma que el enlace lleva a un formulario de aplicación directa. */
  directApply?: boolean;
  /** Payload original, para depurar / reprocesar. */
  raw?: unknown;
}

export interface ImportContext {
  /** Tope de ofertas a procesar en esta corrida (protege el límite de 30 s de Vercel). */
  maxJobs: number;
  /** Momento límite (epoch ms): el adaptador debe parar de emitir al alcanzarlo. */
  deadline: number;
  signal?: AbortSignal;
}

export interface JobSourceAdapter {
  readonly platform: string;
  readonly displayName: string;
  readonly kind: 'direct' | 'ats' | 'feed' | 'search';
  /** Emite ofertas de forma perezosa (respeta `ctx.maxJobs` y `ctx.deadline`). */
  fetchJobs(ctx: ImportContext): AsyncIterable<RawJob>;
  /** (Opcional) comprueba si una oferta sigue viva en la fuente. */
  checkAlive?(job: { sourceJobId: string; sourceUrl?: string | null }): Promise<boolean>;
}

/** Config tipada que guarda `job_sources.config`. */
export interface SourceConfig {
  /** Greenhouse: board token — https://boards-api.greenhouse.io/v1/boards/<token>/jobs */
  greenhouseToken?: string;
  /** Lever: company handle — https://api.lever.co/v0/postings/<handle> */
  leverHandle?: string;
  /** CSV: URL pública del archivo curado. */
  csvUrl?: string;
  /** Jooble: términos de búsqueda para acotar el volumen. */
  joobleQueries?: { keywords: string; location?: string }[];
  /** Nombre del empleador (cuando la fuente es el propio ATS de una empresa). */
  companyName?: string;
}

export type BuildAdapter = (source: JobSource) => JobSourceAdapter;
