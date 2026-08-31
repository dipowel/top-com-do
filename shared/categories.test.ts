import { describe, it, expect } from 'vitest';
import {
  CATEGORY_DEFS,
  CATEGORY_SLUGS,
  SUBCATEGORY_DEFS,
  subSlug,
  subcategoryLabel,
  subcategoriesWithSlugsFor,
} from './categories';

describe('categories', () => {
  it('incluye las 3 categorías nuevas', () => {
    for (const s of ['ocio', 'educacion', 'mascotas']) {
      expect(CATEGORY_SLUGS).toContain(s);
    }
  });

  it('gastronomía tiene los rubros nuevos', () => {
    const g = CATEGORY_DEFS.find((c) => c.slug === 'gastronomia')!;
    expect(g.subcategories).toContain('Liquor Stores y Drinks');
    expect(g.subcategories).toContain('Colmados Premium');
    expect(g.subcategories).toContain('Heladerías');
  });

  it('servicios tiene hoteles/villas y financieras', () => {
    const s = CATEGORY_DEFS.find((c) => c.slug === 'servicios')!;
    expect(s.subcategories).toContain('Hoteles, Villas y Cabañas');
    expect(s.subcategories).toContain('Prestamistas, Financieras y Cooperativas');
  });

  it('subSlug es url-safe y estable', () => {
    expect(subSlug('Liquor Stores y Drinks')).toBe('liquor-stores-y-drinks');
    expect(subSlug('Peluquería Canina (Grooming)')).toBe('peluqueria-canina-grooming');
  });

  it('subcategoryLabel hace el roundtrip slug → label', () => {
    for (const s of SUBCATEGORY_DEFS) {
      expect(subcategoryLabel(s.categorySlug, s.slug)).toBe(s.label);
    }
  });

  it('subcategoriesWithSlugsFor devuelve los rubros de la categoría', () => {
    const subs = subcategoriesWithSlugsFor('mascotas');
    expect(subs.map((x) => x.label)).toContain('Clínicas Veterinarias');
    expect(subs.every((x) => /^[a-z0-9-]+$/.test(x.slug))).toBe(true);
  });
});
