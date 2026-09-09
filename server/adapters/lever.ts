/**
 * Lever Postings API — https://help.lever.co/hc/en-us/articles/360044756672
 * `https://api.lever.co/v0/postings/<handle>?mode=json` es pública y pensada para
 * publicar/sindicar las vacantes del empleador. `job_sources.config.leverHandle`.
 */
import type { ImportContext, JobSourceAdapter, RawJob, SourceConfig } from './types';
import { SourceNotAuthorizedError } from './types';
import type { JobSource } from '../../shared/schema';

interface LeverPost {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: { location?: string; team?: string; commitment?: string };
  descriptionPlain?: string;
  description?: string;
  lists?: { text: string; content: string }[];
}

export class LeverAdapter implements JobSourceAdapter {
  readonly platform: string;
  readonly displayName: string;
  readonly kind = 'ats' as const;
  private handle: string;
  private companyName: string;

  constructor(source: JobSource) {
    const cfg = (source.config ?? {}) as SourceConfig;
    if (!cfg.leverHandle) {
      throw new SourceNotAuthorizedError(source.platform, 'falta config.leverHandle (cuenta de Lever del empleador)');
    }
    this.handle = cfg.leverHandle;
    this.companyName = cfg.companyName || source.name;
    this.platform = source.platform;
    this.displayName = source.name;
  }

  async *fetchJobs(ctx: ImportContext): AsyncIterable<RawJob> {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${encodeURIComponent(this.handle)}?mode=json`,
      { headers: { accept: 'application/json' }, signal: ctx.signal },
    );
    if (!res.ok) throw new Error(`Lever ${this.handle}: HTTP ${res.status}`);
    const posts = (await res.json()) as LeverPost[];
    let emitted = 0;
    for (const p of posts) {
      if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
      emitted++;
      const responsibilities = p.lists?.find((l) => /responsab|what you/i.test(l.text))?.content ?? null;
      const requirements = p.lists?.find((l) => /requi|qualif|what we|you have/i.test(l.text))?.content ?? null;
      yield {
        sourceJobId: p.id,
        sourceUrl: p.hostedUrl,
        applyUrl: p.applyUrl || p.hostedUrl,
        directApply: true,
        title: p.text,
        companyName: this.companyName,
        description: p.description ?? p.descriptionPlain ?? null,
        responsibilities,
        requirements,
        locationText: p.categories?.location ?? null,
        category: p.categories?.team ?? null,
        employmentType: p.categories?.commitment ?? null,
        publishedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        raw: p,
      };
    }
  }
}
