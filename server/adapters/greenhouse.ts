/**
 * Greenhouse Job Board API — https://developers.greenhouse.io/job-board.html
 * API pública, sin clave, pensada EXPRESAMENTE para sindicar las vacantes de un
 * empleador. Cada `job_sources` row = el board de una empresa (`config.greenhouseToken`).
 * Contenido = del propio empleador; se re-publica con canonical a Top y `directApply`
 * al formulario de Greenhouse.
 */
import type { ImportContext, JobSourceAdapter, RawJob, SourceConfig } from './types';
import { SourceNotAuthorizedError } from './types';
import type { JobSource } from '../../shared/schema';

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  metadata?: { name: string; value: unknown }[];
}

export class GreenhouseAdapter implements JobSourceAdapter {
  readonly platform: string;
  readonly displayName: string;
  readonly kind = 'ats' as const;
  private token: string;
  private companyName: string;

  constructor(source: JobSource) {
    const cfg = (source.config ?? {}) as SourceConfig;
    if (!cfg.greenhouseToken) {
      throw new SourceNotAuthorizedError(source.platform, 'falta config.greenhouseToken (board de Greenhouse del empleador)');
    }
    this.token = cfg.greenhouseToken;
    this.companyName = cfg.companyName || source.name;
    this.platform = source.platform;
    this.displayName = source.name;
  }

  async *fetchJobs(ctx: ImportContext): AsyncIterable<RawJob> {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(this.token)}/jobs?content=true`,
      { headers: { accept: 'application/json' }, signal: ctx.signal },
    );
    if (!res.ok) throw new Error(`Greenhouse ${this.token}: HTTP ${res.status}`);
    const body = (await res.json()) as { jobs?: GhJob[] };
    let emitted = 0;
    for (const j of body.jobs ?? []) {
      if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
      emitted++;
      yield {
        sourceJobId: String(j.id),
        sourceUrl: j.absolute_url,
        applyUrl: j.absolute_url,
        directApply: true,
        title: j.title,
        companyName: this.companyName,
        description: j.content ?? null, // HTML; el pipeline lo sanea
        locationText: j.location?.name ?? null,
        updatedAt: j.updated_at ?? null,
        raw: j,
      };
    }
  }
}
