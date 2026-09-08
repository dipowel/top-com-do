import { describe, it, expect } from 'vitest';
import {
  JOB_CATEGORY_DEFS,
  JOB_CATEGORY_SLUGS,
  isJobCategory,
  jobCategoryLabel,
} from './job-categories';

describe('job-categories', () => {
  it('los slugs son url-safe y únicos', () => {
    const seen = new Set<string>();
    for (const c of JOB_CATEGORY_DEFS) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(seen.has(c.slug)).toBe(false);
      seen.add(c.slug);
      expect(c.name.trim().length).toBeGreaterThan(0);
    }
    expect(JOB_CATEGORY_SLUGS.length).toBe(JOB_CATEGORY_DEFS.length);
  });

  it('incluye los sectores laborales clave de RD', () => {
    for (const s of ['tecnologia', 'ventas', 'salud', 'construccion', 'transporte', 'otros']) {
      expect(JOB_CATEGORY_SLUGS).toContain(s);
    }
  });

  it('no se solapa 1:1 con las categorías de negocio', () => {
    // "restaurantes" y "turismo-hoteleria" son propias de empleo (negocio usa "gastronomia").
    expect(JOB_CATEGORY_SLUGS).toContain('restaurantes');
    expect(JOB_CATEGORY_SLUGS).not.toContain('gastronomia');
  });

  it('isJobCategory y jobCategoryLabel hacen el roundtrip', () => {
    expect(isJobCategory('tecnologia')).toBe(true);
    expect(isJobCategory('no-existe')).toBe(false);
    expect(isJobCategory(null)).toBe(false);
    for (const c of JOB_CATEGORY_DEFS) {
      expect(jobCategoryLabel(c.slug)).toBe(c.name);
    }
    expect(jobCategoryLabel('no-existe')).toBe('');
  });
});
