/**
 * SEO local de Top.com.do: títulos y meta descripciones con menciones geográficas
 * (provincias y sectores de la República Dominicana) + constructores de datos
 * estructurados JSON-LD. Todo es puro (sin DOM): lo consume el cliente vía
 * `useSeo` y el servidor para `GET /sitemap.xml`.
 */
import { SITE_URL, SOCIAL_URLS, profileShareUrl } from './site';
import { CATEGORY_DEFS, SUBCATEGORY_DEFS, subcategoryLabel } from './categories';
import { PROVINCE_DEFS, NATIONAL_SLUG, provinceName } from './provinces';
import type { ReviewSummary } from './types';

export const RD = 'República Dominicana';
const LOGO_URL = `${SITE_URL}/logo.png`;
const OG_IMAGE = `${SITE_URL}/og.png`;

export interface SeoData {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  jsonLd?: Record<string, unknown>[];
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Quita el emoji inicial de los nombres de categoría ("🍗 Gastronomía…" → "Gastronomía…"). */
export function cleanName(name: string): string {
  return name.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** Nombre legible de una categoría a partir de su slug (sin emoji). */
export function categoryLabel(slug: string | null | undefined): string {
  const def = CATEGORY_DEFS.find((c) => c.slug === slug);
  return def ? cleanName(def.name) : '';
}

function zoneLabel(province?: string | null, city?: string | null): string {
  return city?.trim() || (province ? provinceName(province) || RD : RD);
}

// ---------------- Meta por tipo de página ----------------

export function homeSeo(): SeoData {
  return {
    title: 'Top.com.do — Publicidad y ranking #1 de negocios en República Dominicana',
    description:
      'Plataforma de publicidad y ranking #1 de la República Dominicana. Un solo líder por provincia y categoría: paga para desplazar a tu competencia y recibe llamadas directas a tu WhatsApp. Negocios verificados en las 32 provincias.',
    canonical: `${SITE_URL}/`,
    image: OG_IMAGE,
    jsonLd: [organizationLd(), websiteLd()],
  };
}

export function exploreSeo(categorySlug?: string | null, query?: string | null): SeoData {
  const cat = categoryLabel(categorySlug);
  const path = categorySlug && cat ? `/explorar/${categorySlug}` : '/explorar';
  if (cat) {
    return {
      title: `${cat} en República Dominicana — Explorar negocios | Top.com.do`,
      description: `Explora negocios de ${cat} en toda la República Dominicana. Perfiles verificados con reseñas reales, ubicación y contacto directo por WhatsApp en Top.com.do.`,
      canonical: `${SITE_URL}${path}`,
      image: OG_IMAGE,
    };
  }
  return {
    title: 'Explorar negocios en República Dominicana | Top.com.do',
    description:
      query?.trim()
        ? `Resultados para "${query.trim()}" en el directorio de negocios de la República Dominicana.`
        : 'Explora todo el directorio de negocios de la República Dominicana por categoría. Perfiles verificados con reseñas, ubicación y contacto en Top.com.do.',
    canonical: `${SITE_URL}/explorar`,
    image: OG_IMAGE,
  };
}

export function categorySeo(opts: {
  categorySlug: string;
  provinceSlug?: string | null;
  items?: { id: string; name: string }[];
}): SeoData {
  const isAllCats = !opts.categorySlug || opts.categorySlug === 'todo-rd';
  const cat = isAllCats ? 'negocios' : categoryLabel(opts.categorySlug) || 'negocios';
  const isProv = opts.provinceSlug && opts.provinceSlug !== NATIONAL_SLUG;
  const zone = isProv ? provinceName(opts.provinceSlug!) || RD : RD;
  const path = isProv
    ? `/rd/${opts.categorySlug}/${opts.provinceSlug}`
    : `/rd/${opts.categorySlug}`;
  const canonical = `${SITE_URL}${path}`;
  return {
    title: `Los mejores ${cat} en ${zone} | Top.com.do`,
    description: `Ranking verificado de ${cat} en ${zone}${isProv ? `, ${RD}` : ''}. Compara negocios por reputación, reseñas reales y cercanía, encuentra el #1 y contáctalo directo. Actualizado en vivo en Top.com.do.`,
    canonical,
    image: OG_IMAGE,
    jsonLd: opts.items && opts.items.length ? [itemListLd(opts.items, canonical, `${cat} en ${zone}`)] : undefined,
  };
}

/** Landing de subcategoría a nivel nacional: /explorar/{categoria}/{sub}. */
export function subcategorySeo(opts: {
  categorySlug: string;
  subSlug: string;
  items?: { id: string; name: string }[];
}): SeoData {
  const sub = subcategoryLabel(opts.categorySlug, opts.subSlug) || categoryLabel(opts.categorySlug);
  const canonical = `${SITE_URL}/explorar/${opts.categorySlug}/${opts.subSlug}`;
  return {
    title: `Mejor ${sub} en ${RD} | Top.com.do`,
    description: `Directorio verificado de ${sub} en la ${RD}. Compara por reputación y reseñas reales, mira ubicación y contacta directo por WhatsApp. Actualizado en vivo en Top.com.do.`,
    canonical,
    image: OG_IMAGE,
    jsonLd:
      opts.items && opts.items.length
        ? [itemListLd(opts.items, canonical, `Mejor ${sub} en ${RD}`)]
        : undefined,
  };
}

export interface ProfileSeoInput {
  id: string;
  name: string;
  subcategory?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  province?: string | null;
  provinceName?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avatarUrl?: string | null;
  whatsapp?: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  tagline?: string | null;
  bio?: string | null;
}

export function profileSeo(p: ProfileSeoInput, summary?: ReviewSummary | null): SeoData {
  const sector =
    p.subcategory?.trim() ||
    cleanName(p.categoryName || '') ||
    categoryLabel(p.categorySlug) ||
    'Negocio';
  const zone = zoneLabel(p.province, p.city);
  const provName = p.provinceName || (p.province ? provinceName(p.province) : '');
  const base = (p.tagline || p.bio || '').trim();
  const description =
    (base ? `${base} ` : '') +
    `${p.name} — ${sector} en ${zone}${provName && provName !== zone ? `, ${provName}` : ''}, ${RD}. ` +
    `Reputación verificada${summary && summary.count > 0 ? ` (${summary.average}★ · ${summary.count} reseñas)` : ''}, ubicación y contacto directo en Top.com.do.`;
  return {
    title: `${p.name} — ${sector} en ${zone} | Top.com.do`,
    description: description.slice(0, 300),
    canonical: profileShareUrl(p.id),
    image: p.avatarUrl && /^https?:\/\//.test(p.avatarUrl) ? p.avatarUrl : OG_IMAGE,
    jsonLd: [localBusinessLd(p, summary)],
  };
}

// ---------------- Constructores JSON-LD ----------------

export function organizationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Top.com.do',
    alternateName: 'Top RD',
    slogan: 'El directorio #1 de la República Dominicana',
    url: `${SITE_URL}/`,
    logo: LOGO_URL,
    image: OG_IMAGE,
    description:
      'Directorio de autoridad y subastas de visibilidad de la República Dominicana.',
    areaServed: { '@type': 'Country', name: RD },
    sameAs: SOCIAL_URLS,
  };
}

export function websiteLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Top.com.do',
    url: `${SITE_URL}/`,
    inLanguage: 'es-DO',
    publisher: { '@type': 'Organization', name: 'Top.com.do', logo: LOGO_URL },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/explorar?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function itemListLd(
  items: { id: string; name: string }[],
  url: string,
  name?: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(name ? { name } : {}),
    url,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: profileShareUrl(it.id),
      name: it.name,
    })),
  };
}

export function localBusinessLd(
  p: ProfileSeoInput,
  summary?: ReviewSummary | null,
): Record<string, unknown> {
  const provName = p.provinceName || (p.province ? provinceName(p.province) : '');
  const sameAs = [p.instagramUrl, p.websiteUrl].filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
  const phone = p.whatsapp ? p.whatsapp.replace(/[^\d+]/g, '') : '';
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': profileShareUrl(p.id),
    name: p.name,
    url: profileShareUrl(p.id),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'DO',
      ...(provName ? { addressRegion: provName } : {}),
      ...(p.city ? { addressLocality: p.city } : {}),
      ...(p.address ? { streetAddress: p.address } : {}),
    },
    areaServed: { '@type': 'Country', name: RD },
  };
  if (p.avatarUrl && /^https?:\/\//.test(p.avatarUrl)) ld.image = p.avatarUrl;
  if (p.tagline || p.bio) ld.description = (p.tagline || p.bio || '').slice(0, 300);
  if (phone) ld.telephone = phone;
  if (p.latitude != null && p.longitude != null) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude };
  }
  if (sameAs.length) ld.sameAs = sameAs;
  if (summary && summary.count > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: summary.average,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return ld;
}

// ---------------- Sitemap ----------------

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

/** Todas las rutas indexables: portada, explorar, landings categoría×provincia y fichas. */
export function sitemapUrls(
  profiles: { id: string; createdAt?: string | Date | null }[] = [],
): SitemapEntry[] {
  const cats = CATEGORY_DEFS.filter((c) => c.slug !== 'todo-rd');
  const provs = PROVINCE_DEFS.filter((p) => p.slug !== NATIONAL_SLUG);

  const out: SitemapEntry[] = [
    { loc: `${SITE_URL}/`, changefreq: 'hourly', priority: 1 },
    { loc: `${SITE_URL}/explorar`, changefreq: 'daily', priority: 0.8 },
    { loc: `${SITE_URL}/terminos`, changefreq: 'yearly', priority: 0.3 },
    { loc: `${SITE_URL}/privacidad`, changefreq: 'yearly', priority: 0.3 },
    { loc: `${SITE_URL}/normas`, changefreq: 'yearly', priority: 0.3 },
  ];

  for (const c of cats) {
    out.push({ loc: `${SITE_URL}/rd/${c.slug}`, changefreq: 'daily', priority: 0.7 });
    out.push({ loc: `${SITE_URL}/explorar/${c.slug}`, changefreq: 'daily', priority: 0.5 });
    for (const p of provs) {
      out.push({ loc: `${SITE_URL}/rd/${c.slug}/${p.slug}`, changefreq: 'daily', priority: 0.55 });
    }
  }

  for (const s of SUBCATEGORY_DEFS) {
    out.push({
      loc: `${SITE_URL}/explorar/${s.categorySlug}/${s.slug}`,
      changefreq: 'weekly',
      priority: 0.6,
    });
  }

  for (const pr of profiles) {
    out.push({
      loc: profileShareUrl(pr.id),
      lastmod: pr.createdAt ? new Date(pr.createdAt).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: 0.9,
    });
  }

  return out;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

export function renderSitemap(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const lines = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority != null) lines.push(`    <priority>${e.priority.toFixed(2)}</priority>`);
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
