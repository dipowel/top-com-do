import { describe, it, expect } from 'vitest';
import {
  homeSeo,
  categorySeo,
  profileSeo,
  exploreSeo,
  localBusinessLd,
  organizationLd,
  sitemapUrls,
  renderSitemap,
} from './seo';

describe('seo · títulos y descripciones con geografía', () => {
  it('portada menciona República Dominicana', () => {
    const s = homeSeo();
    expect(s.title).toMatch(/República Dominicana/);
    expect(s.canonical).toBe('https://www.top.com.do/');
    expect(s.jsonLd?.[0]).toMatchObject({ '@type': 'Organization' });
  });

  it('categoría + provincia produce título y canónico geolocalizados', () => {
    const s = categorySeo({ categorySlug: 'gastronomia', provinceSlug: 'santiago' });
    expect(s.title).toBe('Los mejores Gastronomía y Comida en Santiago | Top.com.do');
    expect(s.canonical).toBe('https://www.top.com.do/rd/gastronomia/santiago');
    expect(s.description).toMatch(/Santiago/);
  });

  it('categoría sin provincia usa República Dominicana', () => {
    const s = categorySeo({ categorySlug: 'automotriz' });
    expect(s.canonical).toBe('https://www.top.com.do/rd/automotriz');
    expect(s.title).toMatch(/en República Dominicana/);
  });

  it('explorar por categoría tiene canónico propio', () => {
    expect(exploreSeo('salud').canonical).toBe('https://www.top.com.do/explorar/salud');
    expect(exploreSeo(null).canonical).toBe('https://www.top.com.do/explorar');
  });
});

describe('seo · LocalBusiness', () => {
  const base = {
    id: 'abc',
    name: 'Pica Pollo El Rey',
    subcategory: 'Pica Pollos',
    categoryName: '🍗 Gastronomía y Comida',
    province: 'santiago',
    city: 'Santiago de los Caballeros',
    address: 'Av. 27 de Febrero 100',
    latitude: 19.45,
    longitude: -70.7,
    whatsapp: '+1 809 555 1234',
    instagramUrl: 'https://instagram.com/elrey',
    avatarUrl: 'https://cdn.example.com/rey.png',
  };

  it('incluye país DO y datos de dirección', () => {
    const ld = localBusinessLd(base);
    expect(ld['@type']).toBe('LocalBusiness');
    expect((ld.address as Record<string, unknown>).addressCountry).toBe('DO');
    expect((ld.address as Record<string, unknown>).addressRegion).toBe('Santiago');
    expect(ld.geo).toMatchObject({ latitude: 19.45, longitude: -70.7 });
    expect(ld.telephone).toBe('+18095551234');
  });

  it('omite aggregateRating cuando no hay reseñas', () => {
    expect(localBusinessLd(base, { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }).aggregateRating).toBeUndefined();
  });

  it('incluye aggregateRating cuando hay reseñas', () => {
    const ld = localBusinessLd(base, {
      average: 4.6,
      count: 12,
      distribution: { '1': 0, '2': 1, '3': 1, '4': 2, '5': 8 },
    });
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.6, reviewCount: 12 });
  });

  it('profileSeo devuelve título con negocio + zona', () => {
    const s = profileSeo(base);
    expect(s.title).toBe('Pica Pollo El Rey — Pica Pollos en Santiago de los Caballeros | Top.com.do');
    expect(s.jsonLd?.[0]['@type']).toBe('LocalBusiness');
  });
});

describe('seo · sitemap', () => {
  it('incluye portada, landings categoría×provincia y fichas', () => {
    const urls = sitemapUrls([{ id: 'p1', createdAt: '2026-01-02T00:00:00Z' }]);
    const locs = urls.map((u) => u.loc);
    expect(locs).toContain('https://www.top.com.do/');
    expect(locs).toContain('https://www.top.com.do/rd/gastronomia/santiago');
    expect(locs).toContain('https://www.top.com.do/p/p1');
    expect(locs).toContain('https://www.top.com.do/terminos');
    expect(locs).not.toContain('https://www.top.com.do/rd/todo-rd');
  });

  it('renderiza XML válido', () => {
    const xml = renderSitemap(sitemapUrls([{ id: 'p1', createdAt: '2026-01-02T00:00:00Z' }]));
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml).toMatch(/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    expect(xml).toMatch(/<lastmod>2026-01-02<\/lastmod>/);
  });

  it('organizationLd lleva las 3 redes en sameAs', () => {
    expect((organizationLd().sameAs as string[]).length).toBe(3);
  });
});
