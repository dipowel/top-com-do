import { describe, it, expect } from 'vitest';
import {
  jobSlug,
  dedupeKey,
  formatSalary,
  isJobVisible,
  hasEnoughJobsForIndexing,
  normalizeText,
  SCHEMA_EMPLOYMENT_TYPE,
  JOB_TYPE_VALUES,
} from './jobs';

describe('jobs · jobSlug', () => {
  it('normaliza acentos, espacios y símbolos', () => {
    expect(jobSlug('Diseñador Gráfico Señor', 'Santo Domingo')).toBe(
      'disenador-grafico-senor-santo-domingo',
    );
  });

  it('recorta a 80 caracteres y nunca termina en guion', () => {
    const s = jobSlug('a'.repeat(120));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith('-')).toBe(false);
  });

  it('cae a "empleo" si el título queda vacío', () => {
    expect(jobSlug('!!!', '')).toBe('empleo');
  });
});

describe('jobs · dedupeKey', () => {
  it('ignora mayúsculas, acentos y espacios', () => {
    const a = dedupeKey({ companyName: '  Acme  SRL ', title: 'Cajero/a', city: 'Santiago' });
    const b = dedupeKey({ companyName: 'ACME SRL', title: 'cajero/a', city: 'SANTIAGO' });
    expect(a).toBe(b);
  });

  it('usa provincia si no hay ciudad', () => {
    const k = dedupeKey({ companyName: 'X', title: 'Y', province: 'santiago' });
    expect(k).toContain('santiago');
  });
});

describe('jobs · formatSalary', () => {
  it('rango con periodo', () => {
    const out = formatSalary({ min: 35000, max: 45000, currency: 'DOP', period: 'monthly' });
    expect(out).toMatch(/35[,.]000/);
    expect(out).toMatch(/45[,.]000/);
    expect(out).toContain('–');
    expect(out).toContain('al mes');
  });

  it('solo mínimo → "Desde"', () => {
    const out = formatSalary({ min: 30000, currency: 'DOP', period: 'monthly' });
    expect(out).toMatch(/^Desde /);
    expect(out).toMatch(/30[,.]000/);
    expect(out).toContain('al mes');
  });

  it('negociable', () => {
    expect(formatSalary({ min: 1, period: 'negotiable' })).toBe('Salario a convenir');
  });

  it('sin datos → cadena vacía', () => {
    expect(formatSalary({})).toBe('');
  });
});

describe('jobs · isJobVisible', () => {
  it('publicado y sin expiración es visible', () => {
    expect(isJobVisible({ status: 'published' })).toBe(true);
  });

  it('borrador / cerrado / expirado no son visibles', () => {
    expect(isJobVisible({ status: 'draft' })).toBe(false);
    expect(isJobVisible({ status: 'closed' })).toBe(false);
    expect(isJobVisible({ status: 'expired' })).toBe(false);
  });

  it('publicado pero con expiración pasada no es visible', () => {
    expect(isJobVisible({ status: 'published', expiresAt: '2000-01-01T00:00:00Z' })).toBe(false);
    expect(isJobVisible({ status: 'published', expiresAt: '2999-01-01T00:00:00Z' })).toBe(true);
  });
});

describe('jobs · hasEnoughJobsForIndexing', () => {
  const fresh = new Date().toISOString();

  it('exige volumen, diversidad y frescura', () => {
    expect(hasEnoughJobsForIndexing({ activeCount: 6, distinctCompanies: 4, newestPublishedAt: fresh })).toBe(true);
  });

  it('rechaza pocos empleos', () => {
    expect(hasEnoughJobsForIndexing({ activeCount: 3, distinctCompanies: 3, newestPublishedAt: fresh })).toBe(false);
  });

  it('rechaza poca diversidad de empresas', () => {
    expect(hasEnoughJobsForIndexing({ activeCount: 10, distinctCompanies: 2, newestPublishedAt: fresh })).toBe(false);
  });

  it('rechaza contenido rancio (>45 días) o vacío', () => {
    expect(
      hasEnoughJobsForIndexing({ activeCount: 10, distinctCompanies: 5, newestPublishedAt: '2020-01-01T00:00:00Z' }),
    ).toBe(false);
    expect(hasEnoughJobsForIndexing({ activeCount: 10, distinctCompanies: 5, newestPublishedAt: null })).toBe(false);
  });
});

describe('jobs · misc', () => {
  it('normalizeText colapsa espacios y quita acentos', () => {
    expect(normalizeText('  Él  Músico  ')).toBe('el musico');
  });

  it('cada tipo de empleo mapea a un employmentType de Schema.org', () => {
    for (const t of JOB_TYPE_VALUES) {
      expect(SCHEMA_EMPLOYMENT_TYPE[t]).toMatch(/^[A-Z_]+$/);
    }
  });
});
