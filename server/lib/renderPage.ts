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
import {
  CATEGORY_SLUGS,
  REAL_CATEGORY_DEFS,
  SUBCATEGORY_DEFS,
  subcategoryLabel,
} from '../../shared/categories';
import { PROVINCE_SLUGS, NATIONAL_SLUG, provinceName, isRealProvince } from '../../shared/provinces';
import { jobCategoryLabel, isJobCategory } from '../../shared/job-categories';
import {
  listJobs,
  getJobForRender,
  jobFacetCounts,
  landingIndexable,
  toJobSeoInput,
  getCompanyJobsBySlug,
} from './jobs';
import { editorialIntro, JOB_TYPE_LABELS, WORK_MODE_LABELS, formatSalary } from '../../shared/jobs';
import { sanitizePlainText } from '../../shared/sanitize';
import {
  homeSeo,
  categorySeo,
  subcategorySeo,
  subcategoryProvinceSeo,
  exploreSeo,
  profileSeo,
  publicarSeo,
  legalSeo,
  directorioSeo,
  empleosSeo,
  jobPostingSeo,
  jobGoneSeo,
  organizationLd,
  websiteLd,
  categoryIntro,
  categoryFaqs,
  categoryLabel,
  categoryNoun,
  cleanName,
  RD,
  type SeoData,
} from '../../shared/seo';
import { SITE_URL, profileAvatarUrl } from '../../shared/site';
import { whatsappLink } from '../../shared/phone';
import { PAGE_SHELL } from '../generated/pageShell';

export interface RenderResult {
  html: string;
  status: number;
  cacheSeconds: number;
  /** true → la respuesta debe llevar además la cabecera `X-Robots-Tag: noindex`. */
  noindex: boolean;
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

type Crumb = { name: string; href?: string };

function crumbNav(items: Crumb[]): string {
  if (items.length < 2) return '';
  const parts = items.map((c, i) =>
    c.href && i < items.length - 1
      ? `<a href="${esc(c.href)}" style="color:#9aa4b2">${esc(c.name)}</a>`
      : `<span style="color:#cfd6e2">${esc(c.name)}</span>`,
  );
  return `<nav aria-label="Ruta de navegación" style="font-size:.75rem;color:#6b7482;margin:0 0 .5rem">${parts.join(' › ')}</nav>`;
}

function hero(h1Html: string, pText: string, extra = '', crumbsHtml = ''): string {
  return (
    `<div id="ssr-hero" style="${HERO_STYLE}">` +
    crumbsHtml +
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

interface SsrItem {
  id: string;
  name: string;
  sub?: string | null;
  image?: string | null;
  city?: string | null;
  province?: string | null;
  categorySlug?: string | null;
}

function listBody(
  heading: string,
  intro: string,
  items: SsrItem[],
  crumbs: Crumb[] = [],
  faqs: { q: string; a: string }[] = [],
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
  const faqHtml = faqs.length
    ? `<section style="margin-top:1.2rem"><h2 style="font-size:1rem;font-weight:800;margin:0 0 .5rem">Preguntas frecuentes</h2>` +
      faqs
        .map(
          (f) =>
            `<p style="margin:.5rem 0"><strong style="color:#cfd6e2">${esc(f.q)}</strong><br>` +
            `<span style="color:#9aa4b2">${esc(f.a)}</span></p>`,
        )
        .join('') +
      `</section>`
    : '';
  return hero(esc(heading), intro, ul + faqHtml, crumbNav(crumbs));
}

// ---------------- data ----------------

const ITEM_COLUMNS = {
  id: P.id,
  name: P.name,
  sub: P.subcategory,
  image: P.avatarUrl,
  city: P.city,
  province: P.province,
  categorySlug: C.slug,
};

async function catItems(cat: string, prov: string | null): Promise<SsrItem[]> {
  try {
    const r = await getRankings(cat, prov ?? undefined, 24);
    if (r.length)
      return r.map((e) => ({
        id: e.profile.id,
        name: e.profile.name,
        sub: e.profile.subcategory ?? null,
        image: profileAvatarUrl(e.profile.id, e.profile.avatarUrl),
        city: e.profile.city,
        province: e.profile.province,
        categorySlug: e.profile.categorySlug,
      }));
  } catch {
    /* sigue al fallback */
  }
  try {
    const rows = await db
      .select(ITEM_COLUMNS)
      .from(P)
      .innerJoin(C, eq(C.id, P.categoryId))
      .where(
        and(eq(P.isActive, true), eq(C.slug, cat), prov ? eq(P.province, prov) : undefined),
      )
      .orderBy(desc(P.createdAt))
      .limit(24);
    return rows.map((x) => ({ ...x, image: profileAvatarUrl(x.id, x.image) }));
  } catch {
    return [];
  }
}

async function subItems(cat: string, subLabel: string, prov: string | null): Promise<SsrItem[]> {
  try {
    const rows = await db
      .select(ITEM_COLUMNS)
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
    return rows.map((x) => ({ ...x, image: profileAvatarUrl(x.id, x.image) }));
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
      avatarUrl: profileAvatarUrl(row.id, row.avatarUrl),
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

  if (
    segs.length === 1 &&
    (head === 'terminos' ||
      head === 'privacidad' ||
      head === 'normas' ||
      head === 'devoluciones' ||
      head === 'entrega' ||
      head === 'seguridad-pagos' ||
      head === 'contacto')
  ) {
    const seo = legalSeo(head);
    return {
      seo,
      status: 200,
      cache: 86400,
      body: hero(esc(seo.title.split(' | ')[0]), seo.description),
    };
  }

  if (segs.length === 1 && head === 'directorio') {
    const seo = directorioSeo();
    const provs = PROVINCE_SLUGS.filter((s) => s !== NATIONAL_SLUG);
    const li = (href: string, label: string) =>
      `<li><a href="${esc(href)}" style="color:#e8c874">${esc(label)}</a></li>`;
    const ulOpen = '<ul style="list-style:none;padding:0;margin:0 0 1rem;display:grid;gap:.3rem;font-size:.9rem">';
    const h2 = (t: string) => `<h2 style="font-size:1rem;font-weight:800;margin:1.2rem 0 .4rem">${t}</h2>`;
    const catBlock = REAL_CATEGORY_DEFS.map((c) => {
      const subs = SUBCATEGORY_DEFS.filter((s) => s.categorySlug === c.slug)
        .map((s) => li(`/explorar/${c.slug}/${s.slug}`, `${s.label} en RD`))
        .join('');
      const provLinks = provs.map((p) => li(`/rd/${c.slug}/${p}`, `${cleanName(c.name)} en ${provinceName(p)}`)).join('');
      return h2(esc(cleanName(c.name))) + ulOpen + li(`/rd/${c.slug}`, `Ranking de ${cleanName(c.name)}`) + subs + provLinks + '</ul>';
    }).join('');
    const provBlock =
      h2('Negocios por provincia') +
      ulOpen +
      provs.map((p) => li(`/rd/todo-rd/${p}`, `Negocios en ${provinceName(p)}`)).join('') +
      '</ul>';
    const body = hero(
      'Directorio de negocios de la República Dominicana',
      seo.description,
      provBlock + catBlock,
      crumbNav([{ name: 'Inicio', href: '/' }, { name: 'Directorio' }]),
    );
    return { seo, status: 200, cache: 3600, body };
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
    ['login', 'perfil', 'registrar-negocio', 'mis-pujas', 'favoritos', 'notificaciones', 'admin', 'recibo'].includes(
      head,
    )
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
        `<a href="${esc(whatsappLink(row.whatsapp))}" style="color:#34d399">WhatsApp</a>`,
      );
    if (row.instagramUrl)
      links.push(`<a href="${esc(row.instagramUrl)}" style="color:#e8c874">Instagram</a>`);
    if (row.websiteUrl)
      links.push(`<a href="${esc(row.websiteUrl)}" style="color:#e8c874">Sitio web</a>`);
    const extra = links.length
      ? `<p style="font-size:.9rem">${links.join(' · ')}</p>`
      : '';
    const crumbs: Crumb[] = [
      { name: 'Inicio', href: '/' },
      ...(row.categorySlug
        ? [{ name: categoryLabel(row.categorySlug) || row.categoryName, href: `/rd/${row.categorySlug}` }]
        : []),
      ...(row.provinceName && row.province
        ? [{ name: row.provinceName, href: `/rd/${row.categorySlug}/${row.province}` }]
        : []),
      { name: row.name },
    ];
    return {
      seo,
      status: 200,
      cache: 300,
      body: hero(esc(row.name), seo.description, extra, crumbNav(crumbs)),
    };
  }

  if (head === 'empleo' && segs[1]) {
    let result: Awaited<ReturnType<typeof getJobForRender>> = { kind: 'notfound' };
    try {
      result = await getJobForRender(segs[1]);
    } catch {
      result = { kind: 'notfound' };
    }
    if (result.kind === 'notfound') return notFound(pathname);

    const row = result.row;
    const provName = row.province ? provinceName(row.province) || '' : '';
    const relatedLis = result.related
      .map(
        (j) =>
          `<li><a href="/empleo/${esc(j.slug)}" style="color:#e8c874">${esc(j.title)}</a> ` +
          `<span style="color:#9aa4b2">— ${esc(j.companyName)}</span></li>`,
      )
      .join('');
    const relatedBlock = relatedLis
      ? `<h2 style="font-size:1rem;margin:1.2rem 0 .4rem">Ofertas similares</h2>` +
        `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:.35rem;font-size:.9rem">${relatedLis}</ul>`
      : '';

    const crumbs = crumbNav([
      { name: 'Inicio', href: '/' },
      { name: 'Empleos', href: '/empleos' },
      { name: jobCategoryLabel(row.category) || 'Empleos', href: `/empleos/${row.category}` },
      { name: row.title },
    ]);

    // Vacante retirada / expirada / cerrada → "lápida" 410, sin JobPosting.
    if (result.kind === 'gone') {
      return {
        seo: jobGoneSeo({ slug: row.slug, title: row.title, category: row.category }),
        status: 410,
        cache: 300,
        body: hero(
          esc(row.title),
          'Esta vacante ya no está disponible. La oferta fue retirada o expiró.',
          `<p style="${P_STYLE}">Puedes explorar otras oportunidades activas en <a href="/empleos" style="color:#e8c874">Empleos</a>.</p>${relatedBlock}`,
          crumbs,
        ),
      };
    }

    const zone = row.city || provName || (row.workMode === 'remote' ? 'Remoto' : RD);
    const jobTypeLabel = JOB_TYPE_LABELS[row.jobType as keyof typeof JOB_TYPE_LABELS] ?? row.jobType;
    const workModeLabel = WORK_MODE_LABELS[row.workMode as keyof typeof WORK_MODE_LABELS] ?? row.workMode;
    const seo = jobPostingSeo(toJobSeoInput(row));
    const salaryLabel = formatSalary({
      min: row.salaryMin == null ? null : Number(row.salaryMin),
      max: row.salaryMax == null ? null : Number(row.salaryMax),
      currency: row.salaryCurrency,
      period: row.salaryPeriod,
    });

    const metaRows: string[] = [
      `<strong>${esc(row.companyName)}</strong>`,
      `📍 ${esc([row.city, provName].filter(Boolean).join(', ') || zone)}`,
      `🕒 ${esc(jobTypeLabel)} · ${esc(workModeLabel)}`,
    ];
    if (salaryLabel) metaRows.push(`💰 ${esc(salaryLabel)}`);
    if (row.streetAddress) metaRows.push(`🏢 ${esc(row.streetAddress)}${row.postalCode ? `, ${esc(row.postalCode)}` : ''}`);
    if (row.expiresAt) metaRows.push(`⏳ Válido hasta ${new Date(row.expiresAt).toLocaleDateString('es-DO')}`);

    const section = (title: string, textHtml: string) =>
      textHtml ? `<h2 style="font-size:1rem;margin:1.2rem 0 .4rem">${title}</h2><div style="font-size:.92rem;line-height:1.6;color:#c8cfda;white-space:pre-wrap">${textHtml}</div>` : '';

    const descText = sanitizePlainText(row.description);
    const about = descText.length >= 120 ? esc(descText) : esc(editorialIntro({
      title: row.title,
      companyName: row.companyName,
      city: row.city,
      provinceName: provName || null,
      workMode: row.workMode,
      jobType: row.jobType,
      sourceName: row.sourceName,
    }) + (descText ? `\n\n${descText}` : ''));

    const applyHref =
      row.applicationUrl ||
      (row.applicationEmail ? `mailto:${row.applicationEmail}` : row.contactWhatsapp ? whatsappLink(row.contactWhatsapp) : '');
    const applyBlock = applyHref
      ? `<p style="margin:1rem 0"><a href="${esc(applyHref)}" rel="nofollow noopener noreferrer" style="display:inline-block;background:#e8c874;color:#1a1a1a;padding:.6rem 1.1rem;border-radius:.5rem;font-weight:700;text-decoration:none">Aplicar a esta vacante</a></p>`
      : '';
    const sourceBlock =
      row.sourcePlatform && row.sourcePlatform !== 'direct'
        ? `<p style="font-size:.8rem;color:#8a93a2;margin-top:1rem">Fuente de la oferta: ${esc(row.sourceName || row.sourcePlatform)}${
            row.sourceUrl ? ` · <a href="${esc(row.sourceUrl)}" rel="nofollow noopener noreferrer" style="color:#8a93a2">ver publicación original</a>` : ''
          }</p>`
        : '';

    return {
      seo,
      status: 200,
      cache: 600,
      body: hero(
        esc(row.title),
        metaRows.join(' · ').replace(/<\/?strong>/g, ''),
        `<div style="font-size:.9rem;color:#c8cfda">${metaRows.join('<br>')}</div>` +
          applyBlock +
          section('Sobre esta oportunidad', about) +
          section('Responsabilidades', esc(sanitizePlainText(row.responsibilities))) +
          section('Requisitos', esc(sanitizePlainText(row.requirements))) +
          sourceBlock +
          relatedBlock,
        crumbs,
      ),
    };
  }

  if (head === 'empleos') {
    if (segs[1] === 'publicar' || segs[1] === 'mis-vacantes') {
      return {
        seo: { ...homeSeo(), canonical: `${SITE_URL}/empleos/${segs[1]}`, noindex: true },
        status: 200,
        cache: 60,
        body: homeBody(),
      };
    }

    // Landing de empresa: /empleos/empresa/:slug
    if (segs[1] === 'empresa' && segs[2]) {
      let data: Awaited<ReturnType<typeof getCompanyJobsBySlug>> = null;
      try {
        data = await getCompanyJobsBySlug(segs[2]);
      } catch {
        data = null;
      }
      const canonical = `${SITE_URL}/empleos/empresa/${esc(segs[2])}`;
      if (!data) {
        return {
          seo: {
            title: 'Empresa · Empleos | Top.com.do',
            description: 'Vacantes por empresa en Top.com.do.',
            canonical,
            noindex: true,
            jsonLd: [],
          },
          status: 200,
          cache: 300,
          body: hero('Sin vacantes activas', 'Esta empresa no tiene vacantes activas ahora mismo.'),
        };
      }
      const indexable = data.jobs.length >= 3;
      const lis = data.jobs
        .map(
          (j) =>
            `<li><a href="/empleo/${esc(j.slug)}" style="color:#e8c874">${esc(j.title)}</a> ` +
            `<span style="color:#9aa4b2">— ${esc(j.provinceName || j.city || RD)}</span></li>`,
        )
        .join('');
      return {
        seo: {
          title: `Empleos en ${data.companyName} | Top.com.do`.slice(0, 110),
          description: `${data.jobs.length} vacante${data.jobs.length === 1 ? '' : 's'} activa${
            data.jobs.length === 1 ? '' : 's'
          } en ${data.companyName}. Postúlate directo en Top.com.do.`,
          canonical,
          image: `${SITE_URL}/og.png`,
          noindex: !indexable,
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              url: canonical,
              numberOfItems: data.jobs.length,
              itemListElement: data.jobs.map((j, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE_URL}/empleo/${j.slug}`,
                name: j.title,
              })),
            },
          ],
        },
        status: 200,
        cache: 600,
        body: hero(
          `Empleos en ${esc(data.companyName)}`,
          `${data.jobs.length} vacantes activas`,
          `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:.4rem;font-size:.9rem">${lis}</ul>`,
          crumbNav([
            { name: 'Inicio', href: '/' },
            { name: 'Empleos', href: '/empleos' },
            { name: data.companyName },
          ]),
        ),
      };
    }

    // /empleos/categoria/:cat  →  desambigua categoría de provincia
    const catPrefix = segs[1] === 'categoria';
    const filtro = catPrefix ? segs[2] : segs[1];
    const provSeg = isRealProvince(catPrefix ? segs[3] : segs[2]) ? (catPrefix ? segs[3] : segs[2]) : null;
    const catSlug = isJobCategory(filtro) ? filtro : null;
    const provSlug = !catSlug && !catPrefix && isRealProvince(filtro) ? filtro : provSeg;

    if (segs.length > 1 && !catSlug && !provSlug) return notFound(pathname);

    let items: { slug: string; title: string; companyName: string; sub: string }[] = [];
    let indexable = true;
    try {
      if (catSlug || provSlug) {
        const facets = await jobFacetCounts();
        indexable = landingIndexable(facets, catSlug, provSlug).indexable;
      }
      const list = await listJobs({
        category: catSlug ?? undefined,
        province: provSlug ?? undefined,
        limit: 24,
      });
      items = list.items.map((j) => ({
        slug: j.slug,
        title: j.title,
        companyName: j.companyName,
        sub: [j.provinceName || j.city, j.jobTypeLabel].filter(Boolean).join(' · '),
      }));
    } catch {
      items = [];
      indexable = false;
    }

    const seo = empleosSeo({
      categorySlug: catSlug,
      provinceSlug: provSlug,
      items: items.map((i) => ({ slug: i.slug, title: i.title })),
      indexable: (catSlug || provSlug) ? indexable : true,
    });
    const lis = items
      .map(
        (i) =>
          `<li><a href="/empleo/${esc(i.slug)}" style="color:#e8c874">${esc(i.title)}</a> ` +
          `<span style="color:#9aa4b2">— ${esc(i.companyName)}${i.sub ? ` · ${esc(i.sub)}` : ''}</span></li>`,
      )
      .join('');
    const ul = items.length
      ? `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:.4rem;font-size:.9rem">${lis}</ul>`
      : '<p style="color:#9aa4b2">Aún no hay vacantes publicadas en esta sección. <a href="/empleos/publicar" style="color:#e8c874">Publica la tuya gratis</a>.</p>';
    const heading = catSlug
      ? `Empleos de ${jobCategoryLabel(catSlug)} en ${provSlug ? provinceName(provSlug) : RD}`
      : provSlug
        ? `Empleos en ${provinceName(provSlug)}`
        : 'Empleos en República Dominicana';
    return {
      seo,
      status: 200,
      cache: catSlug || provSlug ? 600 : 900,
      body: hero(
        esc(heading),
        seo.description,
        ul,
        crumbNav([
          { name: 'Inicio', href: '/' },
          { name: 'Empleos', href: '/empleos' },
          ...(catSlug ? [{ name: jobCategoryLabel(catSlug), href: `/empleos/${catSlug}` }] : []),
          ...(provSlug ? [{ name: provinceName(provSlug) }] : []),
        ]),
      ),
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
      items,
    });
    // Sin negocios reales en esa zona: no exponer una página vacía al índice.
    const empty = items.length === 0;
    return {
      seo: empty ? { ...seo, noindex: true } : seo,
      status: 200,
      cache: empty ? 300 : 900,
      body: listBody(
        `Los mejores ${allCats ? 'negocios' : categoryNoun(cat)} en ${zone}`,
        categoryIntro(allCats ? null : cat, zone),
        items,
        [
          { name: 'Inicio', href: '/' },
          ...(allCats ? [] : [{ name: categoryLabel(cat), href: `/rd/${cat}` }]),
          ...(prov ? [{ name: zone }] : []),
        ],
        empty ? [] : categoryFaqs(allCats ? null : cat, zone),
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
        items,
      });
      const empty = items.length === 0;
      return {
        seo: empty ? { ...seo, noindex: true } : seo,
        status: 200,
        cache: empty ? 300 : 900,
        body: listBody(`Los mejores ${subLabel} en ${RD}`, seo.description, items, [
          { name: 'Inicio', href: '/' },
          { name: categoryLabel(cat), href: `/rd/${cat}` },
          { name: subLabel },
        ]),
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
        body: listBody(`Los mejores ${subLabel} en ${provinceName(prov)}`, '', []),
      };
    }
    const seo = subcategoryProvinceSeo({
      categorySlug: cat,
      subSlug: sub,
      provinceSlug: prov,
      items,
    });
    return {
      seo,
      status: 200,
      cache: 900,
      body: listBody(`Los mejores ${subLabel} en ${provinceName(prov)}`, seo.description, items, [
        { name: 'Inicio', href: '/' },
        { name: categoryLabel(cat), href: `/rd/${cat}` },
        { name: subLabel, href: `/explorar/${cat}/${sub}` },
        { name: provinceName(prov) },
      ]),
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
    html = setMeta(html, 'name', 'robots', 'noindex,follow');
  }
  html = html.replace(/<!--LD-->[\s\S]*?<!--\/LD-->/, `<!--LD-->\n    ${ld}\n    <!--/LD-->`);
  html = html.replace(/<!--SSR-->[\s\S]*?<!--\/SSR-->/, `<!--SSR-->\n      ${body}\n      <!--/SSR-->`);
  return html;
}

export async function renderPage(pathname: string): Promise<RenderResult> {
  try {
    const { seo, status, cache, body } = await resolve(pathname);
    return { html: buildHtml(seo, body), status, cacheSeconds: cache, noindex: !!seo.noindex };
  } catch {
    return {
      html: buildHtml({ ...homeSeo(), noindex: true }, homeBody()),
      status: 200,
      cacheSeconds: 60,
      noindex: true,
    };
  }
}
