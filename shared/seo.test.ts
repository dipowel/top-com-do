import { describe, it, expect } from 'vitest';
import {
  homeSeo,
  categorySeo,
  subcategorySeo,
  subcategoryProvinceSeo,
  profileSeo,
  exploreSeo,
  publicarSeo,
  legalSeo,
  localBusinessLd,
  organizationLd,
  breadcrumbLd,
  faqPageLd,
  businessSchemaType,
  sitemapUrls,
  renderSitemap,
} from './seo';

describe('seo · títulos y descripciones con geografía', () => {
  it('portada: publicidad + ranking + República Dominicana', () => {
    const s = homeSeo();
    expect(s.title).toMatch(/Publicidad/);
    expect(s.title).toMatch(/República Dominicana/);
    expect(s.title.toLowerCase()).toContain('publicidad efectiva');
    expect(s.description).toMatch(/WhatsApp/);
    expect(s.description.toLowerCase()).toContain('directorio de negocios');
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

  it('subcategoría genera "Mejor {rubro} en RD" y canónico propio', () => {
    const s = subcategorySeo({ categorySlug: 'gastronomia', subSlug: 'liquor-stores-y-drinks' });
    expect(s.title).toBe('Mejor Liquor Stores y Drinks en República Dominicana | Top.com.do');
    expect(s.canonical).toBe('https://www.top.com.do/explorar/gastronomia/liquor-stores-y-drinks');
  });

  it('sub-rubro × provincia: título y canónico hiperlocales', () => {
    const s = subcategoryProvinceSeo({
      categorySlug: 'automotriz',
      subSlug: 'gomeras-y-alineacion',
      provinceSlug: 'santo-domingo',
    });
    expect(s.title).toBe('Mejor Gomeras y Alineación en Santo Domingo | Top.com.do');
    expect(s.canonical).toBe(
      'https://www.top.com.do/explorar/automotriz/gomeras-y-alineacion/santo-domingo',
    );
    expect(s.jsonLd?.some((o) => o['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('/publicar apunta a intención de anunciar/posicionar y lleva FAQPage', () => {
    const s = publicarSeo();
    expect(s.canonical).toBe('https://www.top.com.do/publicar');
    expect(s.title.toLowerCase()).toContain('anuncia tu negocio');
    expect(s.description.toLowerCase()).toMatch(/registra tu negocio gratis/);
    expect(s.jsonLd?.[0]).toMatchObject({ '@type': 'FAQPage' });
  });

  it('legalSeo da canónico por tipo', () => {
    expect(legalSeo('normas').canonical).toBe('https://www.top.com.do/normas');
    expect(legalSeo('terminos').title).toMatch(/Términos/);
  });

  it('businessSchemaType mapea categoría → tipo Schema.org', () => {
    expect(businessSchemaType('gastronomia')).toBe('Restaurant');
    expect(businessSchemaType('inmobiliaria')).toBe('RealEstateAgent');
    expect(businessSchemaType('desconocida')).toBe('LocalBusiness');
    expect(businessSchemaType(null)).toBe('LocalBusiness');
  });

  it('breadcrumbLd y faqPageLd tienen la forma correcta', () => {
    const b = breadcrumbLd([
      { name: 'Inicio', url: 'https://www.top.com.do/' },
      { name: 'Santiago', url: 'https://www.top.com.do/rd/gastronomia/santiago' },
    ]);
    expect(b['@type']).toBe('BreadcrumbList');
    expect((b.itemListElement as unknown[]).length).toBe(2);
    const f = faqPageLd([{ q: '¿Cuánto cuesta?', a: 'Desde RD$100.' }]);
    expect(f['@type']).toBe('FAQPage');
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
    expect(locs).toContain('https://www.top.com.do/explorar/gastronomia/liquor-stores-y-drinks');
    expect(locs).toContain('https://www.top.com.do/explorar/mascotas/clinicas-veterinarias');
    expect(locs).toContain(
      'https://www.top.com.do/explorar/automotriz/gasolineras-y-estaciones-de-servicio',
    );
    expect(locs).toContain('https://www.top.com.do/explorar/inmobiliaria/inmobiliarias-y-alquileres');
    expect(locs).toContain('https://www.top.com.do/publicar');
    expect(locs).not.toContain('https://www.top.com.do/rd/todo-rd');
  });

  it('incluye combos sub-rubro × provincia cuando se pasan', () => {
    const urls = sitemapUrls(
      [],
      [{ categorySlug: 'automotriz', subSlug: 'gomeras-y-alineacion', provinceSlug: 'santiago' }],
    );
    expect(urls.map((u) => u.loc)).toContain(
      'https://www.top.com.do/explorar/automotriz/gomeras-y-alineacion/santiago',
    );
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
