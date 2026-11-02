import 'dotenv/config';
import { Pool } from 'pg';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Fase 0 de la migración al modelo orgánico: línea base de SEO. Recorre URLs públicas reales
 * (tomadas de la base de datos de producción, no inventadas) contra el sitio EN VIVO
 * (https://www.top.com.do), guarda título/meta description/canonical/robots/H1/JSON-LD de cada
 * una en `seo-baseline.json` (en la raíz del repo, versionado en git) para poder comparar
 * después de cada fase siguiente. También copia `sitemap.xml`/`robots.txt` tal cual, y corre
 * Lighthouse móvil sobre 3 páginas clave.
 *
 * Uso: node scripts/seo-baseline.mjs
 */

const SITE = 'https://www.top.com.do';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeoBaselineBot/1.0)' } });
  const html = await res.text();
  const pick = (re) => (html.match(re)?.[1] ?? null).trim?.() ?? html.match(re)?.[1] ?? null;
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ?? null;
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1] ?? null;
  const robotsMeta = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)?.[1] ?? null;
  const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() ?? null;
  const jsonLdTypes = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try { return JSON.parse(m[1])['@type']; } catch { return 'parse_error'; }
    });
  return { url, status: res.status, title, description, canonical, robotsMeta, h1, jsonLdTypes };
}

async function buildUrlList() {
  const urls = [`${SITE}/`];

  // Categoría × provincia con negocios reales (no se inventan combinaciones vacías).
  const combos = await pool.query(`
    select c.slug as cat, p.province as prov, count(*) as n
    from profiles p join categories c on c.id = p.category_id
    where p.is_active = true and p.province is not null
    group by c.slug, p.province
    having count(*) >= 1
    order by n desc
    limit 8
  `);
  for (const r of combos.rows) urls.push(`${SITE}/rd/${r.cat}/${r.prov}`);

  const cats = await pool.query(`select slug from categories where is_active = true and slug <> 'todo-rd' limit 5`);
  for (const r of cats.rows) urls.push(`${SITE}/rd/${r.slug}`);

  const profiles = await pool.query(`select id from profiles where is_active = true order by created_at asc limit 10`);
  for (const r of profiles.rows) urls.push(`${SITE}/p/${r.id}`);

  const jobs = await pool.query(`select slug from jobs where status = 'published' order by published_at desc limit 8`);
  for (const r of jobs.rows) urls.push(`${SITE}/empleo/${r.slug}`);

  urls.push(`${SITE}/empleos`);
  const jobCombos = await pool.query(`
    select province, count(*) as n from jobs
    where status = 'published' and province is not null
    group by province order by n desc limit 5
  `);
  for (const r of jobCombos.rows) urls.push(`${SITE}/empleos/todas/${r.province}`);

  return urls;
}

function runLighthouse(url) {
  const out = `_lh_${Buffer.from(url).toString('base64url')}.json`;
  execFileSync(
    'npx',
    ['--yes', 'lighthouse', url, '--preset=desktop', '--emulated-form-factor=mobile',
     '--output=json', `--output-path=./${out}`, '--chrome-flags=--headless=new --no-sandbox', '--quiet'],
    { stdio: 'ignore', shell: true },
  );
  const r = JSON.parse(readFileSyncSafe(out));
  deleteFileSafe(out);
  if (!r) return null;
  return {
    url,
    performance: r.categories?.performance?.score ?? null,
    seo: r.categories?.seo?.score ?? null,
    lcp: r.audits?.['largest-contentful-paint']?.displayValue ?? null,
    cls: r.audits?.['cumulative-layout-shift']?.displayValue ?? null,
    tbt: r.audits?.['total-blocking-time']?.displayValue ?? null,
  };
}

function readFileSyncSafe(f) { return existsSync(f) ? readFileSync(f, 'utf8') : null; }
function deleteFileSafe(f) { if (existsSync(f)) unlinkSync(f); }

async function main() {
  console.log('[seo-baseline] Construyendo lista de URLs reales desde la base de datos...');
  const urls = await buildUrlList();
  console.log(`[seo-baseline] ${urls.length} URLs a revisar.`);

  const pages = [];
  for (const url of urls) {
    try {
      pages.push(await fetchPage(url));
      console.log(`  ✓ ${url}`);
    } catch (e) {
      pages.push({ url, error: String(e) });
      console.log(`  ✗ ${url}: ${e.message}`);
    }
  }

  console.log('[seo-baseline] Copiando sitemap.xml y robots.txt...');
  const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const robots = await (await fetch(`${SITE}/robots.txt`)).text();
  writeFileSync('seo-baseline-sitemap.xml', sitemap);
  writeFileSync('seo-baseline-robots.txt', robots);

  console.log('[seo-baseline] Corriendo Lighthouse móvil (home, lista de empleos, detalle de empleo)...');
  const firstJob = pages.find((p) => p.url.includes('/empleo/'));
  const lighthousePages = [`${SITE}/`, `${SITE}/empleos`, firstJob?.url].filter(Boolean);
  const lighthouse = [];
  for (const url of lighthousePages) {
    try {
      lighthouse.push(runLighthouse(url));
      console.log(`  ✓ lighthouse ${url}`);
    } catch (e) {
      lighthouse.push({ url, error: String(e) });
      console.log(`  ✗ lighthouse ${url}: ${e.message}`);
    }
  }

  const baseline = {
    capturedAt: new Date().toISOString(),
    site: SITE,
    pages,
    lighthouse,
    sitemapUrlCount: (sitemap.match(/<loc>/g) || []).length,
  };
  writeFileSync('seo-baseline.json', JSON.stringify(baseline, null, 2));
  console.log(`\n[seo-baseline] Completo. ${pages.length} páginas, ${lighthouse.length} Lighthouse, sitemap con ${baseline.sitemapUrlCount} URLs.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
