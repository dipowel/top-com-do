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
  directorioSeo,
  localBusinessLd,
  organizationLd,
  breadcrumbLd,
  faqPageLd,
  businessSchemaType,
  categoryNoun,
  categoryFaqs,
  itemListLd,
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

  it('categoría + provincia: título gramatical (plural) y canónico geolocalizado', () => {
    const s = categorySeo({ categorySlug: 'gastronomia', provinceSlug: 'santiago' });
    expect(s.title).toBe('Mejores restaurantes en Santiago · Top.com.do');
    expect(s.canonical).toBe('https://www.top.com.do/rd/gastronomia/santiago');
    expect(s.description).toMatch(/Santiago/);
  });

  it('categoría sin provincia usa República Dominicana', () => {
    const s = categorySeo({ categorySlug: 'automotriz' });
    expect(s.canonical).toBe('https://www.top.com.do/rd/automotriz');
    expect(s.title).toBe('Mejores talleres en República Dominicana · Top.com.do');
  });

  it('explorar por categoría canoniza hacia el ranking; explorar raíz mantiene su canónico', () => {
    expect(exploreSeo('salud').canonical).toBe('https://www.top.com.do/rd/salud');
    expect(exploreSeo(null).canonical).toBe('https://www.top.com.do/explorar');
  });

  it('subcategoría: título en plural "Mejores {rubro} en RD" y canónico propio', () => {
    const s = subcategorySeo({ categorySlug: 'gastronomia', subSlug: 'liquor-stores-y-drinks' });
    expect(s.title).toBe('Mejores Liquor Stores y Drinks en República Dominicana · Top.com.do');
    expect(s.canonical).toBe('https://www.top.com.do/explorar/gastronomia/liquor-stores-y-drinks');
  });

  it('sub-rubro × provincia: título y canónico hiperlocales', () => {
    const s = subcategoryProvinceSeo({
      categorySlug: 'automotriz',
      subSlug: 'gomeras-y-alineacion',
      provinceSlug: 'santo-domingo',
    });
    expect(s.title).toBe('Mejores Gomeras y Alineación en Santo Domingo · Top.com.do');
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

  it('directorioSeo: canónico propio + BreadcrumbList', () => {
    const s = directorioSeo();
    expect(s.canonical).toBe('https://www.top.com.do/directorio');
    expect(s.jsonLd?.[0]['@type']).toBe('BreadcrumbList');
  });

  it('businessSchemaType mapea categoría → tipo Schema.org', () => {
    expect(businessSchemaType('gastronomia')).toBe('Restaurant');
    expect(businessSchemaType('inmobiliaria')).toBe('RealEstateAgent');
    expect(businessSchemaType('desconocida')).toBe('LocalBusiness');
    expect(businessSchemaType(null)).toBe('LocalBusiness');
  });

  it('categoryNoun da plurales cortos y gramaticales; fallback "negocios"', () => {
    expect(categoryNoun('gastronomia')).toBe('restaurantes');
    expect(categoryNoun('automotriz')).toBe('talleres');
    expect(categoryNoun('desconocida')).toBe('negocios');
    expect(categoryNoun(null)).toBe('negocios');
  });

  it('categoryFaqs devuelve 3 preguntas contextualizadas por zona', () => {
    const f = categoryFaqs('gastronomia', 'Santiago');
    expect(f).toHaveLength(3);
    expect(f[0].q).toContain('restaurantes');
    expect(f[0].q).toContain('Santiago');
  });

  it('categorySeo con items lleva ItemList (con LocalBusiness) + FAQPage', () => {
    const s = categorySeo({
      categorySlug: 'gastronomia',
      provinceSlug: 'santiago',
      items: [{ id: 'a', name: 'Pica Pollo El Rey', province: 'santiago', categorySlug: 'gastronomia' }],
    });
    const list = s.jsonLd?.find((o) => o['@type'] === 'ItemList') as Record<string, unknown>;
    expect(list).toBeTruthy();
    const first = (list.itemListElement as Record<string, unknown>[])[0];
    expect((first.item as Record<string, unknown>)['@type']).toBe('Restaurant');
    expect(s.jsonLd?.some((o) => o['@type'] === 'FAQPage')).toBe(true);
  });

  it('itemListLd embebe objetos LocalBusiness con dirección', () => {
    const ld = itemListLd(
      [{ id: 'x', name: 'Taller Central', province: 'santo-domingo', city: 'Santo Domingo Este', categorySlug: 'automotriz' }],
      'https://www.top.com.do/rd/automotriz/santo-domingo',
    );
    const item = (ld.itemListElement as Record<string, unknown>[])[0].item as Record<string, unknown>;
    expect(item['@type']).toBe('AutoRepair');
    expect((item.address as Record<string, unknown>).addressRegion).toBe('Santo Domingo');
    expect((item.address as Record<string, unknown>).addressLocality).toBe('Santo Domingo Este');
  });

  it('organizationLd incluye NAP (contactPoint + address)', () => {
    const o = organizationLd();
    expect((o.contactPoint as Record<string, unknown>).telephone).toBe('+18296497160');
    expect((o.address as Record<string, unknown>).addressLocality).toBe('Santo Domingo');
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

  it('antepone el +1 de RD cuando el teléfono guardado no lo trae', () => {
    const ld = localBusinessLd({ ...base, whatsapp: '809-555-1234' });
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
    expect(s.title).toBe('Pica Pollo El Rey — Pica Pollos en Santiago de los Caballeros · Top.com.do');
    expect(s.jsonLd?.[0]['@type']).toBe('LocalBusiness');
  });
});

describe('seo · sitemap', () => {
  it('incluye portada, categorías, explorar y fichas; NO genera cat×provincia a ciegas', () => {
    const urls = sitemapUrls([{ id: 'p1', createdAt: '2026-01-02T00:00:00Z' }]);
    const locs = urls.map((u) => u.loc);
    expect(locs).toContain('https://www.top.com.do/');
    expect(locs).toContain('https://www.top.com.do/directorio');
    expect(locs).toContain('https://www.top.com.do/rd/gastronomia');
    expect(locs).toContain('https://www.top.com.do/p/p1');
    expect(locs).toContain('https://www.top.com.do/terminos');
    expect(locs).toContain('https://www.top.com.do/publicar');
    // Sin datos pasados: nada de landings hiperlocales ni /explorar/:cat a secas.
    expect(locs).not.toContain('https://www.top.com.do/rd/gastronomia/santiago');
    expect(locs).not.toContain('https://www.top.com.do/explorar/salud');
    expect(locs).not.toContain('https://www.top.com.do/explorar/gastronomia/liquor-stores-y-drinks');
    expect(locs).not.toContain('https://www.top.com.do/rd/todo-rd');
  });

  it('incluye landings hiperlocales SOLO cuando se pasan combos con datos', () => {
    const urls = sitemapUrls(
      [],
      [{ categorySlug: 'automotriz', subSlug: 'gomeras-y-alineacion', provinceSlug: 'santiago', lastmod: '2026-02-01' }],
      [{ categorySlug: 'gastronomia', provinceSlug: 'santiago', lastmod: '2026-03-01' }],
      [{ provinceSlug: 'santiago', lastmod: '2026-03-02' }],
    );
    const byLoc = new Map(urls.map((u) => [u.loc, u]));
    expect(byLoc.has('https://www.top.com.do/explorar/automotriz/gomeras-y-alineacion')).toBe(true);
    expect(byLoc.get('https://www.top.com.do/explorar/automotriz/gomeras-y-alineacion/santiago')?.lastmod).toBe('2026-02-01');
    expect(byLoc.get('https://www.top.com.do/rd/gastronomia/santiago')?.lastmod).toBe('2026-03-01');
    expect(byLoc.get('https://www.top.com.do/rd/todo-rd/santiago')?.lastmod).toBe('2026-03-02');
  });

  it('las páginas de estructura pura no llevan lastmod (frescura honesta)', () => {
    const home = sitemapUrls().find((u) => u.loc === 'https://www.top.com.do/');
    expect(home?.lastmod).toBeUndefined();
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
