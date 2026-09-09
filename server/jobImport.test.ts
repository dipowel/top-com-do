import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildAdapter, hasAdapter, importEnabled } from './adapters/registry';
import { SourceNotAuthorizedError } from './adapters/types';
import { GreenhouseAdapter } from './adapters/greenhouse';
import { LinkedInAdapter, ComputrabajoAdapter } from './adapters/_skeletons';
import type { JobSource } from '../shared/schema';

const fakeSource = (over: Partial<JobSource> = {}): JobSource =>
  ({
    id: '00000000-0000-0000-0000-000000000000',
    name: 'x',
    platform: 'csv',
    baseUrl: null,
    feedUrl: null,
    sourceType: 'feed',
    authorizationStatus: 'authorized',
    isEnabled: true,
    autoPublish: false,
    config: null,
    defaultCategory: null,
    lastRunAt: null,
    lastRunStatus: null,
    lastError: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as JobSource;

describe('adapters · registry', () => {
  const prev = process.env.IMPORT_ENABLED;
  beforeEach(() => {
    process.env.IMPORT_ENABLED = 'true';
  });
  afterEach(() => {
    process.env.IMPORT_ENABLED = prev;
  });

  it('IMPORT_ENABLED=false bloquea todo', () => {
    process.env.IMPORT_ENABLED = 'false';
    expect(importEnabled()).toBe(false);
    expect(() => buildAdapter(fakeSource())).toThrow(SourceNotAuthorizedError);
  });

  it('fuente no autorizada / deshabilitada → error', () => {
    expect(() => buildAdapter(fakeSource({ authorizationStatus: 'none' }))).toThrow(SourceNotAuthorizedError);
    expect(() => buildAdapter(fakeSource({ isEnabled: false }))).toThrow(SourceNotAuthorizedError);
  });

  it('plataforma sin adaptador → error', () => {
    expect(() => buildAdapter(fakeSource({ platform: 'no-existe' }))).toThrow(SourceNotAuthorizedError);
  });

  it('los 4 portales están registrados pero son esqueletos que lanzan', async () => {
    for (const p of ['linkedin', 'computrabajo', 'tecoloco', 'tunuevotrabajo']) {
      expect(hasAdapter(p)).toBe(true);
    }
    const li = new LinkedInAdapter(fakeSource({ platform: 'linkedin' }));
    await expect(async () => {
      for await (const _ of li.fetchJobs({ maxJobs: 1, deadline: Date.now() + 1000 })) void _;
    }).rejects.toThrow(SourceNotAuthorizedError);
    const ct = new ComputrabajoAdapter(fakeSource({ platform: 'computrabajo' }));
    await expect(async () => {
      for await (const _ of ct.fetchJobs({ maxJobs: 1, deadline: Date.now() + 1000 })) void _;
    }).rejects.toThrow(SourceNotAuthorizedError);
  });

  it('Greenhouse exige config.greenhouseToken', () => {
    expect(() => new GreenhouseAdapter(fakeSource({ platform: 'greenhouse', config: null }))).toThrow(
      SourceNotAuthorizedError,
    );
    expect(
      () => new GreenhouseAdapter(fakeSource({ platform: 'greenhouse', config: { greenhouseToken: 'acme' } as never })),
    ).not.toThrow();
  });

  it('Greenhouse itera cada board de una lista "acme, globex"', async () => {
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({ jobs: [] }),
      } as Response;
    }) as typeof fetch;
    try {
      const gh = new GreenhouseAdapter(
        fakeSource({ platform: 'greenhouse', config: { greenhouseToken: 'acme, globex' } as never }),
      );
      for await (const _ of gh.fetchJobs({ maxJobs: 50, deadline: Date.now() + 5000 })) void _;
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/boards/acme/');
    expect(calls[1]).toContain('/boards/globex/');
  });
});
