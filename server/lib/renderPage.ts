/**
 * Render de metadatos en el servidor para bots/redes/Bing: cada URL recibe en el
 * HTML inicial su <title>, meta description, canónico, Open Graph/Twitter, JSON-LD
 * y un <h1> real con enlaces. Reutiliza `shared/seo.ts`. React monta encima
 * (CSR) y reemplaza `#root`, así que no hay hidratación que cuadrar.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { profiles as P, categories as C } from '../../shared/schema';
import { getRankings } from './rankings';
import { reviewSummary } from './reviews';
import { CATEGORY_SLUGS, subcategoryLabel } from '../../shared/categories';
import { PROVINCE_SLUGS, NATIONAL_SLUG, provinceName } from '../../shared/provinces';
import {
  homeSeo,
  categorySeo,
  subcategorySeo,
  subcategoryProvinceSeo,
  exploreSeo,
  profileSeo,
  publicarSeo,
  legalSeo,
  organizationLd,
  websiteLd,
  categoryIntro,
  categoryLabel,
  RD,
  type SeoData,
} from '../../shared/seo';
import { SITE_URL } from '../../shared/site';
import { PAGE_SHELL } from '../generated/pageShell';

export interface RenderResult {
  html: string;
  status: number;
  cacheSeconds: number;
}

const HERO_STYLE =
  "max-width:48rem;margin:0 auto;padding:20px 16px;color:#e8ecf4;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif";
const H1_STYLE = 'font-size:1.5rem;font-weight:800;line-height:1.2;margin:0';
const P_STYLE = 'font-size:.9rem;color:#9aa4b2;line-height:1.6;margin:.6rem 0 1rem';

const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isCat = (s?: string) => !!s && CATEGORY_SLUGS.includes(s) && s !== 'todo-rd';
const isProv = (s?: string) => !!s && PROVINCE_SLUGS.includes(s) && s !== NATIONAL_SLUG;

interface Resolved {
  seo: SeoData;
  status: number;
  cache: number;
  body: string;
}

// ---------------- bodies (#ssr-hero) ----------------

function hero(h1Html: string, pText: string, extra = ''): string {
  return (
    `<div id="ssr-hero" style="${HERO_STYLE}">` +
    `<h1 style="${H1_STYLE}">${h1Html}</h1>` +
    `<p style="${P_STYLE}">${esc(pText)}</p>` +
    extra +
    `</div>`
  );
}

function homeBody(): string {
  return hero(
    `<span style="color:#d4af37">Publicidad efectiva:</span> domina el puesto ` +
      `<span style="color:#d4af37">#1</span> de tu categoría y consigue ` +
      `<span style="color:#d4af37">más clientes potenciales</span>.`,
    'Solo hay un líder por provincia y categoría. Supera a tu competencia con tu puja y recibe llamadas directas a tu WhatsApp.',
  );
}

function listBody(
  heading: string,
  intro: string,
  items: { id: string; name: string; sub?: string | null }[],
): string {
  const lis = items
    .map(
      (i) =>
        `<li><a href="/p/${esc(i.id)}" style="color:#e8c874">${esc(i.name)}</a>` +
        (i.sub ? ` <span style="color:#9aa4b2">— ${esc(i.sub)}</span>` : '') +
        `</li>`,
    )
    .join('');
  const ul = items.length
    ? `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:.4rem;font-size:.9rem">${lis}</ul>`
    : '';
  return hero(esc(heading), intro, ul);
}

// ---------------- data ----------------

async function catItems(
  cat: string,
  prov: string | null,
): Promise<{ id: string; name: string; sub?: string | null }[]> {
  try {
    const r = await getRankings(cat, prov ?? undefined, 24);
    if (r.length)
      return r.map((e) => ({
        id: e.profile.id,
        name: e.profile.name,
        sub: e.profile.subcategory ?? null,
      }));
  } catch {
    /* sigue al fallback */
  }
  try {
    const rows = await db
      .select({ id: P.id, name: P.name, sub: P.subcategory })
      .from(P)
      .innerJoin(C, eq(C.id, P.categoryId))
      .where(
        and(eq(P.isActive, true), eq(C.slug, cat), prov ? eq(P.province, prov) : undefined),
      )
      .orderBy(desc(P.createdAt))
      .limit(24);
    return rows.map((x) => ({ id: x.id, name: x.name, sub: x.sub }));
  } catch {
    return [];
  }
}

async function subItems(
  cat: string,
  subLabel: string,
  prov: string | null,
): Promise<{ id: string; name: string; sub?: string | null }[]> {
  try {
    const rows = await db
      .select({ id: P.id, name: P.name, sub: P.subcategory })
      .from(P)
      .innerJoin(C, eq(C.id, P.categoryId))
      .where(
        and(
          eq(P.isActive, true),
          eq(C.slug, cat),
          eq(P.subcategory, subLabel),
          prov ? eq(P.province, prov) : undefined,
        ),
      )
      .orderBy(desc(P.createdAt))
      .limit(24);
    return rows.map((x) => ({ id: x.id, name: x.name, sub: x.sub }));
  } catch {
    return [];
  }
}

async function loadProfile(id: string) {
  if (!/^[0-9a-fA-F-]{10,60}$/.test(id)) return null;
  try {
    const [row] = await db
      .select({
        id: P.id,
        name: P.name,
        subcategory: P.subcategory,
        tagline: P.tagline,
        bio: P.bio,
        whatsapp: P.whatsapp,
        instagramUrl: P.instagramUrl,
        websiteUrl: P.websiteUrl,
        avatarUrl: P.avatarUrl,
        province: P.province,
        city: P.city,
        address: P.address,
        latitude: P.latitude,
        longitude: P.longitude,
        categorySlug: C.slug,
        categoryName: C.name,
      })
      .from(P)
      .innerJoin(C, eq(C.id, P.categoryId))
      .where(and(eq(P.id, id), eq(P.isActive, true)))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      provinceName: row.province ? provinceName(row.province) : null,
    };
  } catch {
    return null;
  }
}

// ---------------- route → SeoData ----------------

function notFound(pathname: string): Resolved {
  return {
    seo: {
      title: 'Página no encontrada | Top.com.do',
      description:
        'La página que buscas no existe. Explora el directorio de negocios de la República Dominicana en Top.com.do.',
      canonical: `${SITE_URL}${pathname}`,
      image: `${SITE_URL}/og.png`,
      noindex: true,
      jsonLd: [],
    },
    status: 404,
    cache: 60,
    body: hero(
      'Página no encontrada',
      'Vuelve al inicio o explora el directorio de negocios de la República Dominicana.',
    ),
  };
}

async function resolve(pathname: string): Promise<Resolved> {
  const segs = pathname
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

  if (segs.length === 0) return { seo: homeSeo(), status: 200, cache: 600, body: homeBody() };

  const head = segs[0];

  if (segs.length === 1 && (head === 'terminos' || head === 'privacidad' || head === 'normas')) {
    const seo = legalSeo(head);
    return {
      seo,
      status: 200,
      cache: 86400,
      body: hero(esc(seo.title.split(' | ')[0]), seo.description),
    };
  }

  if (segs.length === 1 && head === 'publicar') {
    const seo = publicarSeo();
    return {
      seo,
      status: 200,
      cache: 3600,
      body: hero(
        'Anuncia tu negocio en República Dominicana',
        seo.description,
        '<p style="font-size:.85rem;color:#9aa4b2"><a href="/login?registro=1" style="color:#e8c874">Registra tu negocio gratis</a> · <a href="/normas" style="color:#e8c874">Cómo funciona</a></p>',
      ),
    };
  }

  if (
    head &&
    ['login', 'perfil', 'mis-pujas', 'favoritos', 'notificaciones', 'admin'].includes(head)
  ) {
    return {
      seo: { ...homeSeo(), canonical: `${SITE_URL}/${segs.join('/')}`, noindex: true },
      status: 200,
      cache: 60,
      body: homeBody(),
    };
  }

  if (head === 'p' && segs[1]) {
    const row = await loadProfile(segs[1]);
    if (!row) return notFound(pathname);
    let summary = null;
    try {
      summary = await reviewSummary(row.id);
    } catch {
      summary = null;
    }
    const seo = profileSeo(row, summary);
    const links: string[] = [];
    if (row.whatsapp)
      links.push(
        `<a href="https://wa.me/${esc(row.whatsapp.replace(/[^\d]/g, ''))}" style="color:#34d399">WhatsApp</a>`,
      );
    if (row.instagramUrl)
      links.push(`<a href="${esc(row.instagramUrl)}" style="color:#e8c874">Instagram</a>`);
    if (row.websiteUrl)
      links.push(`<a href="${esc(row.websiteUrl)}" style="color:#e8c874">Sitio web</a>`);
    const extra = links.length
      ? `<p style="font-size:.9rem">${links.join(' · ')}</p>`
      : '';
    return {
      seo,
      status: 200,
      cache: 300,
      body: hero(esc(row.name), seo.description, extra),
    };
  }

  if (head === 'rd') {
    const cat = segs[1];
    const allCats = cat === 'todo-rd';
    const prov = isProv(segs[2]) ? segs[2] : null;
    // /rd/todo-rd → es la portada; /rd/todo-rd/:prov → todos los negocios de esa provincia.
    if (allCats && !prov) {
      return { seo: { ...homeSeo(), canonical: `${SITE_URL}/` }, status: 200, cache: 600, body: homeBody() };
    }
    if (!allCats && !isCat(cat)) return notFound(pathname);
    const catForData = allCats ? undefined : cat;
    const items = await catItems(catForData ?? 'todo-rd', prov);
    const zone = prov ? provinceName(prov) || RD : RD;
    const seo = categorySeo({
      categorySlug: cat,
      provinceSlug: prov,
      items: items.map((i) => ({ id: i.id, name: i.name })),
    });
    return {
      seo,
      status: 200,
      cache: 900,
      body: listBody(
        `Los mejores ${allCats ? 'negocios' : categoryLabel(cat) || 'negocios'} en ${zone}`,
        categoryIntro(allCats ? null : cat, zone),
        items,
      ),
    };
  }

  if (head === 'explorar') {
    if (segs.length === 1) {
      const seo = exploreSeo(null);
      return {
        seo,
        status: 200,
        cache: 900,
        body: hero('Explorar negocios en República Dominicana', seo.description),
      };
    }
    const cat = segs[1];
    if (!isCat(cat)) return notFound(pathname);
    if (segs.length === 2) {
      const seo = exploreSeo(cat);
      return {
        seo,
        status: 200,
        cache: 900,
        body: hero(`${categoryLabel(cat)} en República Dominicana`, seo.description),
      };
    }
    const sub = segs[2];
    const subLabel = subcategoryLabel(cat, sub);
    if (!subLabel) return notFound(pathname);
    if (segs.length === 3) {
      const items = await subItems(cat, subLabel, null);
      const seo = subcategorySeo({
        categorySlug: cat,
        subSlug: sub,
        items: items.map((i) => ({ id: i.id, name: i.name })),
      });
      return {
        seo,
        status: 200,
        cache: 900,
        body: listBody(`Mejor ${subLabel} en ${RD}`, seo.description, items),
      };
    }
    const prov = segs[3];
    if (!isProv(prov)) return notFound(pathname);
    const items = await subItems(cat, subLabel, prov);
    if (!items.length) {
      // sin negocios reales en esa zona: no crear thin content
      return {
        seo: {
          ...subcategoryProvinceSeo({ categorySlug: cat, subSlug: sub, provinceSlug: prov }),
          noindex: true,
        },
        status: 200,
        cache: 300,
        body: listBody(`Mejor ${subLabel} en ${provinceName(prov)}`, '', []),
      };
    }
    const seo = subcategoryProvinceSeo({
      categorySlug: cat,
      subSlug: sub,
      provinceSlug: prov,
      items: items.map((i) => ({ id: i.id, name: i.name })),
    });
    return {
      seo,
      status: 200,
      cache: 900,
      body: listBody(`Mejor ${subLabel} en ${provinceName(prov)}`, seo.description, items),
    };
  }

  return notFound(pathname);
}

// ---------------- HTML ----------------

function setMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
  const tag = `<meta ${attr}="${key}" content="${esc(content)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
}

function buildHtml(seo: SeoData, body: string): string {
  const img = seo.image || `${SITE_URL}/og.png`;
  const ldObjs = seo.jsonLd && seo.jsonLd.length ? seo.jsonLd : [organizationLd(), websiteLd()];
  const ld = ldObjs
    .map(
      (o) =>
        `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ');

  if (!PAGE_SHELL) {
    return (
      `<!doctype html><html lang="es-DO"><head><meta charset="utf-8" />` +
      `<title>${esc(seo.title)}</title>` +
      `<meta name="description" content="${esc(seo.description)}" />` +
      `<link rel="canonical" href="${esc(seo.canonical)}" />` +
      (seo.noindex ? '<meta name="robots" content="noindex,follow" />' : '') +
      `\n    ${ld}` +
      `</head><body><div id="root">${body}</div>` +
      `<script type="module" src="/src/main.tsx"></script></body></html>`
    );
  }

  let html = PAGE_SHELL;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title)}</title>`);
  html = setMeta(html, 'name', 'description', seo.description);
  html = html.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
  );
  html = html.replace(
    /<link rel="alternate" hreflang="es-do"[^>]*>/,
    `<link rel="alternate" hreflang="es-do" href="${esc(seo.canonical)}" />`,
  );
  html = html.replace(
    /<link rel="alternate" hreflang="x-default"[^>]*>/,
    `<link rel="alternate" hreflang="x-default" href="${esc(seo.canonical)}" />`,
  );
  html = setMeta(html, 'property', 'og:title', seo.title);
  html = setMeta(html, 'property', 'og:description', seo.description);
  html = setMeta(html, 'property', 'og:url', seo.canonical);
  html = setMeta(html, 'property', 'og:image', img);
  html = setMeta(html, 'name', 'twitter:title', seo.title);
  html = setMeta(html, 'name', 'twitter:description', seo.description);
  html = setMeta(html, 'name', 'twitter:image', img);
  if (seo.noindex) {
    html = html.replace(
      '<meta charset="UTF-8" />',
      '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex,follow" />',
    );
  }
  html = html.replace(/<!--LD-->[\s\S]*?<!--\/LD-->/, `<!--LD-->\n    ${ld}\n    <!--/LD-->`);
  html = html.replace(/<!--SSR-->[\s\S]*?<!--\/SSR-->/, `<!--SSR-->\n      ${body}\n      <!--/SSR-->`);
  return html;
}

export async function renderPage(pathname: string): Promise<RenderResult> {
  try {
    const { seo, status, cache, body } = await resolve(pathname);
    return { html: buildHtml(seo, body), status, cacheSeconds: cache };
  } catch {
    return {
      html: buildHtml({ ...homeSeo(), noindex: true }, homeBody()),
      status: 200,
      cacheSeconds: 60,
    };
  }
}
