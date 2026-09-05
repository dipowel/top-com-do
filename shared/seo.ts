/**
 * SEO local de Top.com.do: títulos y meta descripciones con menciones geográficas
 * (provincias y sectores de la República Dominicana) + constructores de datos
 * estructurados JSON-LD. Todo es puro (sin DOM): lo consume el cliente vía
 * `useSeo` y el servidor para `GET /sitemap.xml`.
 */
import { SITE_URL, SOCIAL_URLS, profileShareUrl } from './site';
import { CATEGORY_DEFS, subcategoryLabel } from './categories';
import { NATIONAL_SLUG, provinceName } from './provinces';
import { toE164 } from './phone';
import type { ReviewSummary } from './types';

export const RD = 'República Dominicana';
const LOGO_URL = `${SITE_URL}/logo.png`;
const OG_IMAGE = `${SITE_URL}/og.png`;

/**
 * Sustantivo plural corto y natural para encabezar rankings ("Los mejores ___").
 * `categoryLabel` ("Gastronomía y Comida") es femenino singular y produce títulos
 * agramaticales; esto mantiene el español correcto y el título bajo ~60 caracteres.
 */
const CATEGORY_NOUN: Record<string, string> = {
  gastronomia: 'restaurantes',
  automotriz: 'talleres',
  tecnologia: 'tiendas de tecnología',
  hogar: 'ferreterías',
  'moda-belleza': 'salones de belleza',
  salud: 'centros de salud',
  servicios: 'servicios profesionales',
  inmobiliaria: 'inmobiliarias',
  politica: 'figuras políticas',
  ocio: 'discotecas y bares',
  educacion: 'academias',
  mascotas: 'veterinarias',
};

export function categoryNoun(slug?: string | null): string {
  return (slug && CATEGORY_NOUN[slug]) || 'negocios';
}

export interface SeoData {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  jsonLd?: Record<string, unknown>[];
  /** Si true, la página emite <meta name="robots" content="noindex,follow">. */
  noindex?: boolean;
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

/** Tipo de Schema.org más específico según la categoría (todos heredan de LocalBusiness). */
const SCHEMA_TYPE_BY_CATEGORY: Record<string, string> = {
  gastronomia: 'Restaurant',
  automotriz: 'AutoRepair',
  tecnologia: 'ElectronicsStore',
  hogar: 'HardwareStore',
  'moda-belleza': 'HealthAndBeautyBusiness',
  salud: 'MedicalBusiness',
  servicios: 'ProfessionalService',
  inmobiliaria: 'RealEstateAgent',
  ocio: 'EntertainmentBusiness',
  educacion: 'EducationalOrganization',
  mascotas: 'VeterinaryCare',
  politica: 'Organization',
};

export function businessSchemaType(slug?: string | null): string {
  return (slug && SCHEMA_TYPE_BY_CATEGORY[slug]) || 'LocalBusiness';
}

/** Párrafo de intro local por categoría (para el <h1>/<p> renderizado en servidor). */
export function categoryIntro(categorySlug: string | null | undefined, zone: string): string {
  const noun = categoryNoun(categorySlug);
  const ex: Record<string, string> = {
    gastronomia: 'restaurantes, pica pollos, reposterías y cafeterías',
    automotriz: 'talleres, gomeras, repuestos y rent a car',
    tecnologia: 'tiendas de celulares, reparación y electrodomésticos',
    hogar: 'ferreterías, mueblerías, plomeros y electricistas',
    'moda-belleza': 'salones, barberías, boutiques y spas',
    salud: 'farmacias 24h, clínicas, laboratorios y odontólogos',
    servicios: 'abogados, contables, financieras y agencias de viajes',
    inmobiliaria: 'inmobiliarias, corredores, villas y tasadores',
    ocio: 'discotecas, bares, terrazas y lounges',
    educacion: 'universidades, academias de idiomas y autoescuelas',
    mascotas: 'veterinarias, pet shops y peluquería canina',
    politica: 'figuras, candidatos, alcaldías y movimientos',
  };
  const tail = categorySlug && ex[categorySlug] ? ` — ${ex[categorySlug]}` : '';
  return (
    `Ranking verificado de ${noun} en ${zone}${tail}. ` +
    'El orden responde en vivo a la reputación y a las pujas de los últimos 7 días: ' +
    'compara por reseñas reales y cercanía, encuentra el #1 y contáctalo directo por WhatsApp en Top.com.do.'
  );
}

/**
 * FAQ genuina por categoría/zona: alimenta el JSON-LD `FAQPage` y el bloque
 * visible del ranking. Se emite solo en páginas con negocios reales (no thin).
 */
export function categoryFaqs(
  categorySlug: string | null | undefined,
  zone: string,
): { q: string; a: string }[] {
  const noun = categoryNoun(categorySlug);
  return [
    {
      q: `¿Cuáles son los mejores ${noun} en ${zone}?`,
      a: `Son los que lideran el ranking verificado de Top.com.do en ${zone}: se ordenan por la visibilidad acumulada de los últimos 7 días y por reseñas reales de clientes, y el listado se actualiza en vivo.`,
    },
    {
      q: '¿Cómo se decide el orden del ranking?',
      a: 'Suma de pujas verificadas de los últimos 7 días combinada con la reputación de reseñas. No hay acuerdos comerciales ni posiciones fijas: cualquier negocio puede llegar al #1.',
    },
    {
      q: `¿Cómo aparezco entre los primeros ${noun} en ${zone}?`,
      a: 'Registra tu negocio gratis en el directorio y activa una puja desde RD$100 para competir por el primer lugar de tu categoría y provincia.',
    },
  ];
}

// ---------------- Meta por tipo de página ----------------

export function homeSeo(): SeoData {
  return {
    title: 'Top.com.do — Publicidad efectiva y directorio de negocios en República Dominicana',
    description:
      'Publicidad efectiva en República Dominicana: el directorio de negocios donde un solo líder manda por provincia y categoría. Supera a tu competencia con tu puja y recibe llamadas directas a tu WhatsApp. Negocios verificados en las 32 provincias.',
    canonical: `${SITE_URL}/`,
    image: OG_IMAGE,
    jsonLd: [organizationLd(), websiteLd()],
  };
}

export function exploreSeo(categorySlug?: string | null, query?: string | null): SeoData {
  const cat = categoryLabel(categorySlug);
  if (categorySlug && cat) {
    // El directorio por categoría (`/explorar/:cat`) y el ranking (`/rd/:cat`) cubren
    // la misma intención; se canoniza hacia el ranking para no competir contra sí mismos.
    return {
      title: `Directorio de ${cat} en República Dominicana · Top.com.do`,
      description: `Directorio completo de negocios de ${cat} en la República Dominicana. Perfiles verificados con reseñas reales, ubicación y contacto directo por WhatsApp en Top.com.do.`,
      canonical: `${SITE_URL}/rd/${categorySlug}`,
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
  items?: ListItemInput[];
}): SeoData {
  const isAllCats = !opts.categorySlug || opts.categorySlug === 'todo-rd';
  const noun = isAllCats ? 'negocios' : categoryNoun(opts.categorySlug);
  const catLabel = isAllCats ? 'Negocios' : categoryLabel(opts.categorySlug) || 'Negocios';
  const isProv = opts.provinceSlug && opts.provinceSlug !== NATIONAL_SLUG;
  const zone = isProv ? provinceName(opts.provinceSlug!) || RD : RD;
  const path = isProv
    ? `/rd/${opts.categorySlug}/${opts.provinceSlug}`
    : `/rd/${opts.categorySlug}`;
  const canonical = `${SITE_URL}${path}`;
  const crumbs = breadcrumbLd([
    { name: 'Inicio', url: `${SITE_URL}/` },
    { name: catLabel, url: `${SITE_URL}/rd/${opts.categorySlug}` },
    ...(isProv ? [{ name: zone, url: canonical }] : []),
  ]);
  return {
    title: `Mejores ${noun} en ${zone} · Top.com.do`,
    description: `Ranking verificado de ${noun} en ${zone}${isProv ? `, ${RD}` : ''}. Compara por reputación, reseñas reales y cercanía, encuentra el #1 y contáctalo directo por WhatsApp. Actualizado en vivo en Top.com.do.`,
    canonical,
    image: OG_IMAGE,
    jsonLd: [
      ...(opts.items && opts.items.length
        ? [
            itemListLd(opts.items, canonical, `Mejores ${noun} en ${zone}`),
            faqPageLd(categoryFaqs(opts.categorySlug, zone)),
          ]
        : []),
      crumbs,
    ],
  };
}

/** Landing de subcategoría a nivel nacional: /explorar/{categoria}/{sub}. */
export function subcategorySeo(opts: {
  categorySlug: string;
  subSlug: string;
  items?: ListItemInput[];
}): SeoData {
  const sub = subcategoryLabel(opts.categorySlug, opts.subSlug) || categoryLabel(opts.categorySlug);
  const cat = categoryLabel(opts.categorySlug) || 'Negocios';
  const canonical = `${SITE_URL}/explorar/${opts.categorySlug}/${opts.subSlug}`;
  const crumbs = breadcrumbLd([
    { name: 'Inicio', url: `${SITE_URL}/` },
    { name: cat, url: `${SITE_URL}/explorar/${opts.categorySlug}` },
    { name: sub, url: canonical },
  ]);
  return {
    title: `Mejores ${sub} en ${RD} · Top.com.do`,
    description: `Directorio verificado de ${sub} en la ${RD}. Compara por reputación y reseñas reales, mira ubicación y contacta directo por WhatsApp. Actualizado en vivo en Top.com.do.`,
    canonical,
    image: OG_IMAGE,
    jsonLd: [
      ...(opts.items && opts.items.length
        ? [itemListLd(opts.items, canonical, `Mejores ${sub} en ${RD}`)]
        : []),
      crumbs,
    ],
  };
}

/** Landing hiperlocal sub-rubro × provincia: /explorar/{categoria}/{sub}/{provincia}. */
export function subcategoryProvinceSeo(opts: {
  categorySlug: string;
  subSlug: string;
  provinceSlug: string;
  items?: ListItemInput[];
}): SeoData {
  const sub = subcategoryLabel(opts.categorySlug, opts.subSlug) || categoryLabel(opts.categorySlug);
  const cat = categoryLabel(opts.categorySlug) || 'Negocios';
  const prov = provinceName(opts.provinceSlug) || RD;
  const canonical = `${SITE_URL}/explorar/${opts.categorySlug}/${opts.subSlug}/${opts.provinceSlug}`;
  const crumbs = breadcrumbLd([
    { name: 'Inicio', url: `${SITE_URL}/` },
    { name: cat, url: `${SITE_URL}/explorar/${opts.categorySlug}` },
    { name: sub, url: `${SITE_URL}/explorar/${opts.categorySlug}/${opts.subSlug}` },
    { name: prov, url: canonical },
  ]);
  return {
    title: `Mejores ${sub} en ${prov} · Top.com.do`,
    description: `${sub} en ${prov}, ${RD}: directorio verificado con reseñas reales, ubicación y contacto directo por WhatsApp. Encuentra el mejor y contáctalo al instante en Top.com.do.`,
    canonical,
    image: OG_IMAGE,
    jsonLd: [
      ...(opts.items && opts.items.length
        ? [itemListLd(opts.items, canonical, `Mejores ${sub} en ${prov}`)]
        : []),
      crumbs,
    ],
  };
}

/** Página de intención publicitaria: /publicar. */
export function publicarSeo(): SeoData {
  const canonical = `${SITE_URL}/publicar`;
  const faqs = [
    {
      q: '¿Cómo anuncio mi negocio en República Dominicana?',
      a: 'Regístrate gratis en Top.com.do, publica tu negocio con su ubicación y contacto, y puja para colocarlo en el puesto #1 de tu categoría y provincia. Desde RD$100.',
    },
    {
      q: '¿Cuánto cuesta anunciar mi negocio?',
      a: 'Registrar el negocio es gratis. Para liderar el ranking pujas el monto que quieras, empezando en RD$100. Pagas solo si quieres competir por el primer lugar.',
    },
    {
      q: '¿Cómo salgo primero en Google en República Dominicana?',
      a: 'Cada negocio de Top.com.do tiene su propia página optimizada (título, reseñas y datos estructurados) que Google y Bing indexan. Al liderar tu categoría apareces primero dentro del directorio y ganas visibilidad en los buscadores.',
    },
    {
      q: '¿Es una plataforma de publicidad y pauta comercial?',
      a: 'Sí. Top.com.do es un directorio y una subasta de visibilidad: publicidad efectiva y medible para negocios dominicanos, sin agencias ni contratos.',
    },
  ];
  return {
    title:
      'Anuncia tu negocio en República Dominicana — Publicidad efectiva y pauta digital | Top.com.do',
    description:
      'Registra tu negocio gratis y anúncialo en la República Dominicana. Publicidad efectiva por provincia y categoría: puja para salir primero, posiciona tu negocio en Google y recibe clientes directos por WhatsApp. Desde RD$100.',
    canonical,
    image: OG_IMAGE,
    jsonLd: [
      faqPageLd(faqs),
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Publicidad y posicionamiento de negocios',
        provider: { '@type': 'Organization', name: 'Top.com.do', url: `${SITE_URL}/` },
        areaServed: { '@type': 'Country', name: RD },
        offers: { '@type': 'Offer', price: '100', priceCurrency: 'DOP' },
      },
      breadcrumbLd([
        { name: 'Inicio', url: `${SITE_URL}/` },
        { name: 'Anuncia tu negocio', url: canonical },
      ]),
    ],
  };
}

/** Meta de las páginas legales (compartida por LegalLayout y el render en servidor). */
export function legalSeo(kind: 'terminos' | 'privacidad' | 'normas'): SeoData {
  const map = {
    terminos: {
      t: 'Términos y Condiciones',
      d: 'Términos de uso de Top.com.do: cómo funcionan las pujas por el puesto #1, los pagos con Dodo Payments y la política de no reembolsos.',
    },
    privacidad: {
      t: 'Política de Privacidad',
      d: 'Cómo Top.com.do trata y protege tus datos personales en la República Dominicana.',
    },
    normas: {
      t: 'Normas de la comunidad',
      d: 'Cómo funciona el ranking de Top.com.do: ventana móvil de 7 días, pujas verificadas y reglas para negocios y reseñas.',
    },
  } as const;
  const m = map[kind];
  return {
    title: `${m.t} | Top.com.do`,
    description: m.d,
    canonical: `${SITE_URL}/${kind}`,
    image: OG_IMAGE,
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
  const catName = cleanName(p.categoryName || '') || categoryLabel(p.categorySlug);
  const crumbs = breadcrumbLd([
    { name: 'Inicio', url: `${SITE_URL}/` },
    ...(p.categorySlug && catName
      ? [{ name: catName, url: `${SITE_URL}/rd/${p.categorySlug}` }]
      : []),
    ...(provName && p.categorySlug
      ? [{ name: provName, url: `${SITE_URL}/rd/${p.categorySlug}/${p.province}` }]
      : []),
    { name: p.name, url: profileShareUrl(p.id) },
  ]);
  return {
    title: `${p.name} — ${sector} en ${zone} · Top.com.do`,
    description: description.slice(0, 300),
    canonical: profileShareUrl(p.id),
    image: p.avatarUrl && /^https?:\/\//.test(p.avatarUrl) ? p.avatarUrl : OG_IMAGE,
    jsonLd: [localBusinessLd(p, summary), crumbs],
  };
}

// ---------------- Constructores JSON-LD ----------------

export function organizationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Top.com.do',
    alternateName: 'Top RD',
    slogan: 'Publicidad efectiva y directorio de negocios en la República Dominicana',
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: LOGO_URL, width: 560, height: 127 },
    image: OG_IMAGE,
    description:
      'Directorio de autoridad y subastas de visibilidad de la República Dominicana.',
    areaServed: { '@type': 'Country', name: RD },
    address: { '@type': 'PostalAddress', addressLocality: 'Santo Domingo', addressCountry: 'DO' },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+18296497160',
      email: 'topcomdo15@gmail.com',
      contactType: 'customer support',
      areaServed: 'DO',
      availableLanguage: 'Spanish',
    },
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
    publisher: {
      '@type': 'Organization',
      name: 'Top.com.do',
      logo: { '@type': 'ImageObject', url: LOGO_URL, width: 560, height: 127 },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/explorar?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function faqPageLd(qas: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map((x) => ({
      '@type': 'Question',
      name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
  };
}

export interface ListItemInput {
  id: string;
  name: string;
  image?: string | null;
  city?: string | null;
  province?: string | null;
  categorySlug?: string | null;
}

export function itemListLd(
  items: ListItemInput[],
  url: string,
  name?: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(name ? { name } : {}),
    url,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => {
      const provName = it.province ? provinceName(it.province) : '';
      const biz: Record<string, unknown> = {
        '@type': businessSchemaType(it.categorySlug),
        '@id': profileShareUrl(it.id),
        name: it.name,
        url: profileShareUrl(it.id),
      };
      if (it.image && /^https?:\/\//.test(it.image)) biz.image = it.image;
      if (provName || it.city) {
        biz.address = {
          '@type': 'PostalAddress',
          addressCountry: 'DO',
          ...(provName ? { addressRegion: provName } : {}),
          ...(it.city ? { addressLocality: it.city } : {}),
        };
      }
      return { '@type': 'ListItem', position: i + 1, item: biz };
    }),
  };
}

export function localBusinessLd(
  p: ProfileSeoInput,
  summary?: ReviewSummary | null,
): Record<string, unknown> {
  const provName = p.provinceName || (p.province ? provinceName(p.province) : '');
  const sameAs = [p.instagramUrl, p.websiteUrl].filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
  const phone = toE164(p.whatsapp);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': businessSchemaType(p.categorySlug),
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

export interface GeoCombo {
  categorySlug?: string;
  subSlug?: string;
  provinceSlug: string;
  lastmod?: string;
}

/**
 * Rutas indexables. Las landings hiperlocales (`/rd/:cat/:prov`, `/rd/todo-rd/:prov`,
 * `/explorar/:cat/:sub(/:prov)`) NO se generan a ciegas: solo entran las combinaciones
 * que el servidor confirma con negocios reales (evita cientos de páginas vacías). El
 * `lastmod` se reserva para URLs con datos; las páginas de estructura pura lo omiten.
 */
export function sitemapUrls(
  profiles: { id: string; createdAt?: string | Date | null }[] = [],
  subProvinceCombos: GeoCombo[] = [],
  catProvinceCombos: GeoCombo[] = [],
  provinceCombos: GeoCombo[] = [],
): SitemapEntry[] {
  const cats = CATEGORY_DEFS.filter((c) => c.slug !== 'todo-rd');

  const out: SitemapEntry[] = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: 1 },
    { loc: `${SITE_URL}/publicar`, changefreq: 'monthly', priority: 0.7 },
    { loc: `${SITE_URL}/explorar`, changefreq: 'daily', priority: 0.7 },
    { loc: `${SITE_URL}/terminos`, changefreq: 'yearly', priority: 0.3 },
    { loc: `${SITE_URL}/privacidad`, changefreq: 'yearly', priority: 0.3 },
    { loc: `${SITE_URL}/normas`, changefreq: 'yearly', priority: 0.3 },
  ];

  for (const c of cats) {
    out.push({ loc: `${SITE_URL}/rd/${c.slug}`, changefreq: 'weekly', priority: 0.7 });
  }

  // Subcategoría nacional: se deriva de las combinaciones con datos (dedupe).
  const seenNatSub = new Set<string>();
  for (const combo of subProvinceCombos) {
    const key = `${combo.categorySlug}/${combo.subSlug}`;
    if (!seenNatSub.has(key)) {
      seenNatSub.add(key);
      out.push({ loc: `${SITE_URL}/explorar/${key}`, changefreq: 'weekly', priority: 0.55 });
    }
    out.push({
      loc: `${SITE_URL}/explorar/${key}/${combo.provinceSlug}`,
      lastmod: combo.lastmod,
      changefreq: 'weekly',
      priority: 0.5,
    });
  }

  for (const combo of catProvinceCombos) {
    out.push({
      loc: `${SITE_URL}/rd/${combo.categorySlug}/${combo.provinceSlug}`,
      lastmod: combo.lastmod,
      changefreq: 'weekly',
      priority: 0.6,
    });
  }

  for (const combo of provinceCombos) {
    out.push({
      loc: `${SITE_URL}/rd/todo-rd/${combo.provinceSlug}`,
      lastmod: combo.lastmod,
      changefreq: 'weekly',
      priority: 0.55,
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
