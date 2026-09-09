/**
 * Greenhouse Job Board API — https://developers.greenhouse.io/job-board.html
 * API pública, sin clave, pensada EXPRESAMENTE para sindicar las vacantes de un
 * empleador. Cada `job_sources` row = el board de una empresa (`config.greenhouseToken`).
 * Contenido = del propio empleador; se re-publica con canonical a Top y `directApply`
 * al formulario de Greenhouse.
 */
import type { ImportContext, JobSourceAdapter, RawJob, SourceConfig } from './types';
import { SourceNotAuthorizedError, toList } from './types';
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
  private tokens: string[];
  private companyName: string;

  constructor(source: JobSource) {
    const cfg = (source.config ?? {}) as SourceConfig;
    this.tokens = toList(cfg.greenhouseToken);
    if (!this.tokens.length) {
      throw new SourceNotAuthorizedError(
        source.platform,
        'falta config.greenhouseToken (board(s) de Greenhouse del empleador)',
      );
    }
    this.companyName = cfg.companyName || source.name;
    this.platform = source.platform;
    this.displayName = source.name;
  }

  async *fetchJobs(ctx: ImportContext): AsyncIterable<RawJob> {
    let emitted = 0;
    for (const token of this.tokens) {
      if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
        { headers: { accept: 'application/json' }, signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Greenhouse ${token}: HTTP ${res.status}`);
      const body = (await res.json()) as { jobs?: GhJob[] };
      for (const j of body.jobs ?? []) {
        if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
        emitted++;
        yield {
          sourceJobId: `${token}:${j.id}`,
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
}
