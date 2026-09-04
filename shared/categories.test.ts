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
  it('incluye las categorías nuevas', () => {
    for (const s of ['ocio', 'educacion', 'mascotas', 'inmobiliaria']) {
      expect(CATEGORY_SLUGS).toContain(s);
    }
  });

  it('gastronomía tiene los rubros nuevos', () => {
    const g = CATEGORY_DEFS.find((c) => c.slug === 'gastronomia')!;
    expect(g.subcategories[0]).toBe('Restaurantes');
    expect(g.subcategories).toContain('Liquor Stores y Drinks');
    expect(g.subcategories).toContain('Colmados Premium');
    expect(g.subcategories).toContain('Heladerías');
    expect(g.subcategories).toContain('Carnicerías y Surtidos');
    expect(g.subcategories).toContain('Supermercados y Minimarkets');
  });

  it('los sub-rubros nuevos de cada categoría están presentes', () => {
    const sub = (slug: string) => CATEGORY_DEFS.find((c) => c.slug === slug)!.subcategories;
    expect(sub('automotriz')).toContain('Gasolineras y Estaciones de Servicio');
    expect(sub('tecnologia')).toContain('Electrodomésticos y Línea Blanca');
    expect(sub('hogar')).toContain('Jardinería, Viveros y Paisajismo');
    expect(sub('moda-belleza')).toContain('Uñas y Maquillaje (Nail Bars)');
    expect(sub('salud')).toContain('Laboratorios Clínicos y Centros de Referencia');
    expect(sub('ocio')).toContain('Hookah Lounges y Terrazas');
  });

  it('servicios conserva sus rubros y ya no tiene inmobiliaria/hoteles', () => {
    const s = CATEGORY_DEFS.find((c) => c.slug === 'servicios')!;
    expect(s.subcategories).toContain('Prestamistas, Financieras y Cooperativas');
    expect(s.subcategories).not.toContain('Hoteles, Villas y Cabañas');
    expect(s.subcategories).not.toContain('Inmobiliarias y Alquileres');
  });

  it('inmobiliaria recibe los rubros que salieron de servicios', () => {
    const i = CATEGORY_DEFS.find((c) => c.slug === 'inmobiliaria')!;
    expect(i.subcategories).toContain('Inmobiliarias y Alquileres');
    expect(i.subcategories).toContain('Hoteles, Villas y Cabañas');
    expect(i.subcategories).toContain('Tasación y Peritaje Inmobiliario');
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
