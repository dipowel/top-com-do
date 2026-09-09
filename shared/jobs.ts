/**
 * Módulo puro del dominio de EMPLEOS (sin DOM, sin SQL). Lo consumen el cliente,
 * el servidor y `shared/seo.ts`. El ranking económico y "Cerca de mí" NO lo usan.
 */
import { formatDOP, formatUSD } from './fx';

export type JobType = 'full_time' | 'part_time' | 'temporary' | 'internship' | 'freelance' | 'contract';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';
export type SalaryPeriod = 'monthly' | 'weekly' | 'daily' | 'hourly' | 'negotiable';
export type JobStatus = 'draft' | 'published' | 'expired' | 'closed';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  temporary: 'Temporal',
  internship: 'Pasantía',
  freelance: 'Freelance',
  contract: 'Por contrato',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'Presencial',
  hybrid: 'Híbrido',
  remote: 'Remoto',
};

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  monthly: 'al mes',
  weekly: 'a la semana',
  daily: 'al día',
  hourly: 'por hora',
  negotiable: 'a convenir',
};

/** Valores de `employmentType` de Schema.org JobPosting. */
export const SCHEMA_EMPLOYMENT_TYPE: Record<JobType, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  temporary: 'TEMPORARY',
  internship: 'INTERN',
  freelance: 'CONTRACTOR',
  contract: 'CONTRACTOR',
};

export const JOB_TYPE_VALUES: JobType[] = Object.keys(JOB_TYPE_LABELS) as JobType[];
export const WORK_MODE_VALUES: WorkMode[] = Object.keys(WORK_MODE_LABELS) as WorkMode[];
export const SALARY_PERIOD_VALUES: SalaryPeriod[] = Object.keys(SALARY_PERIOD_LABELS) as SalaryPeriod[];

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug URL-safe para `/empleo/:slug`. El servidor le añade un sufijo si colisiona. */
export function jobSlug(title: string, locationHint?: string | null): string {
  const base = `${title} ${locationHint ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
    .replace(/-$/, '');
  return base || 'empleo';
}

/** Clave de deduplicación aproximada (prioridad 3: empresa + título + ubicación). */
export function dedupeKey(job: {
  companyName: string;
  title: string;
  province?: string | null;
  city?: string | null;
}): string {
  return [
    normalizeText(job.companyName),
    normalizeText(job.title),
    normalizeText(job.city || job.province || ''),
  ].join('|');
}

export interface SalaryInput {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  period?: SalaryPeriod | null;
}

/** "RD$35,000 – RD$45,000 al mes" · "A convenir" · "" (sin datos suficientes). */
export function formatSalary(s: SalaryInput): string {
  if (s.period === 'negotiable') return 'Salario a convenir';
  if (s.min == null && s.max == null) return '';
  const fmt = (s.currency || 'DOP').toUpperCase() === 'USD' ? formatUSD : formatDOP;
  const period = s.period ? ` ${SALARY_PERIOD_LABELS[s.period]}` : '';
  if (s.min != null && s.max != null && s.max > s.min) {
    return `${fmt(s.min)} – ${fmt(s.max)}${period}`;
  }
  const one = s.min ?? s.max ?? 0;
  return `Desde ${fmt(one)}${period}`;
}

export function isJobVisible(job: { status: JobStatus; expiresAt?: string | Date | null }): boolean {
  if (job.status !== 'published') return false;
  if (!job.expiresAt) return true;
  return new Date(job.expiresAt).getTime() > Date.now();
}

/**
 * Frase editorial breve y original, construida SOLO con datos reales de la oferta.
 * No inventa beneficios, salario, requisitos ni funciones: si un dato falta, se omite.
 * Sirve como entradilla de "Sobre esta oportunidad" cuando la descripción es escasa
 * y para dar a Google contenido propio (no una copia literal de la fuente).
 */
export function editorialIntro(job: {
  title: string;
  companyName: string;
  city?: string | null;
  provinceName?: string | null;
  workMode?: WorkMode | string | null;
  jobType?: JobType | string | null;
  sourceName?: string | null;
}): string {
  const where =
    [job.city, job.provinceName].filter(Boolean).join(', ') ||
    (job.workMode === 'remote' ? 'modalidad remota' : 'República Dominicana');
  const parts = [`${job.companyName} busca cubrir la posición de ${job.title} en ${where}.`];
  const mode =
    job.workMode === 'remote'
      ? 'El trabajo es remoto'
      : job.workMode === 'hybrid'
        ? 'El trabajo es híbrido'
        : job.workMode === 'onsite'
          ? 'El trabajo es presencial'
          : '';
  const type = job.jobType && JOB_TYPE_LABELS[job.jobType as JobType]
    ? `en jornada de ${JOB_TYPE_LABELS[job.jobType as JobType].toLowerCase()}`
    : '';
  if (mode || type) parts.push([mode, type].filter(Boolean).join(' ') + '.');
  parts.push(
    job.sourceName
      ? `Los detalles y el proceso de aplicación provienen de ${job.sourceName}.`
      : 'Los detalles y el proceso de aplicación los define directamente la empresa.',
  );
  return parts.join(' ');
}

// ---------------- Criterio de indexación de landings programáticas ----------------

/** Mínimo de empleos activos para que una landing categoría/provincia sea indexable. */
export const MIN_JOBS_FOR_INDEX = 5;

export interface IndexingStats {
  /** empleos activos (publicados y sin expirar) en esa combinación. */
  activeCount: number;
  /** empresas distintas entre esos empleos. */
  distinctCompanies: number;
  /** fecha de publicación del más reciente (ISO o Date), o null. */
  newestPublishedAt: string | Date | null;
}

/**
 * Una landing programática (`/empleos/:cat`, `/empleos/:prov`, combinada) solo es
 * indexable si tiene contenido real y fresco. Documentado para poder ajustarlo con
 * datos reales más adelante (§45 del prompt).
 */
export function hasEnoughJobsForIndexing(stats: IndexingStats): boolean {
  if (stats.activeCount < MIN_JOBS_FOR_INDEX) return false;
  if (stats.distinctCompanies < 3) return false;
  if (!stats.newestPublishedAt) return false;
  const ageDays = (Date.now() - new Date(stats.newestPublishedAt).getTime()) / 86_400_000;
  return ageDays <= 45;
}
