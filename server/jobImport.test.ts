import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildAdapter, hasAdapter, importEnabled } from './adapters/registry';
import { SourceNotAuthorizedError } from './adapters/types';
import { GreenhouseAdapter } from './adapters/greenhouse';
import { JoobleAdapter } from './adapters/jooble';
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

describe('adapters · Jooble', () => {
  const prevImport = process.env.IMPORT_ENABLED;
  const prevKey = process.env.JOOBLE_API_KEY;
  beforeEach(() => {
    process.env.IMPORT_ENABLED = 'true';
    process.env.JOOBLE_API_KEY = 'test-key';
  });
  afterEach(() => {
    process.env.IMPORT_ENABLED = prevImport;
    process.env.JOOBLE_API_KEY = prevKey;
  });

  it('exige JOOBLE_API_KEY y authorization_status=authorized', () => {
    delete process.env.JOOBLE_API_KEY;
    expect(() => new JoobleAdapter(fakeSource({ platform: 'jooble' }))).toThrow(SourceNotAuthorizedError);
    process.env.JOOBLE_API_KEY = 'test-key';
    expect(
      () => new JoobleAdapter(fakeSource({ platform: 'jooble', authorizationStatus: 'requested' })),
    ).toThrow(SourceNotAuthorizedError);
  });

  it('usa do.jooble.org y solo emite ofertas de RD con descripción suficiente', async () => {
    const longSnippet = 'Buscamos personal con experiencia. '.repeat(6); // > 120 chars
    const page1 = [
      { id: 1, title: 'Desarrollador', company: 'ACME', location: 'Santo Domingo', snippet: longSnippet, link: 'https://jooble.org/desc/1', type: 'Full-time', updated: '2026-09-09' },
      { id: 2, title: 'Cajero', company: 'Beta', location: 'Santiago', snippet: 'Corto', link: 'https://jooble.org/desc/2' },
      { id: 3, title: 'Analista', company: 'Gamma', location: 'Ciudad de Panamá', snippet: longSnippet, link: 'https://jooble.org/desc/3' },
    ];
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push(String(url));
      const body = JSON.parse(String(init?.body ?? '{}')) as { page?: number };
      return { ok: true, json: async () => ({ jobs: body.page === 1 ? page1 : [] }) } as Response;
    }) as typeof fetch;

    const out: string[] = [];
    try {
      const jb = new JoobleAdapter(
        fakeSource({ platform: 'jooble', config: { joobleQueries: [{ keywords: 'it' }] } as never }),
      );
      for await (const raw of jb.fetchJobs({ maxJobs: 50, deadline: Date.now() + 5000 })) {
        out.push(raw.title);
      }
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(calls[0]).toContain('https://do.jooble.org/api/test-key');
    expect(out).toEqual(['Desarrollador']);
  });
});
