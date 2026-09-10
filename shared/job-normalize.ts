/**
 * Normalización de datos de empleo que llegan de fuentes externas (feeds/ATS) hacia
 * la taxonomía propia de Top.com.do. Puro, sin DOM ni SQL.
 *
 * Principio: si un dato no se puede mapear con seguridad → se deja como estaba o `null`.
 * NUNCA se inventa provincia, categoría, salario ni modalidad.
 */
import { PROVINCE_DEFS, NATIONAL_SLUG, isRealProvince } from './provinces';
import { CITY_DEFS, canonicalCityName } from './cities';
import { JOB_CATEGORY_SLUGS } from './job-categories';
import { normalizeText } from './jobs';

// ---------------- Provincias / municipios ----------------

/** Casa un texto libre ("Santo Domingo Este", "Distrito Nacional") con un slug de provincia. */
export function matchProvince(text: string | null | undefined): string | null {
  const n = normalizeText(text || '');
  if (!n) return null;
  // 1) coincidencia directa con el nombre de la provincia
  const direct = PROVINCE_DEFS.find(
    (p) => p.slug !== NATIONAL_SLUG && (normalizeText(p.name) === n || n.includes(normalizeText(p.name))),
  );
  if (direct) return direct.slug;
  // 2) a través de un municipio conocido
  const city = CITY_DEFS.find((c) => normalizeText(c.name) === n || n.includes(normalizeText(c.name)));
  if (city && isRealProvince(city.provinceSlug)) return city.provinceSlug;
  return null;
}

/**
 * true solo si el texto de ubicación pertenece a la República Dominicana: casa una
 * provincia/municipio real (vía `matchProvince`) o menciona explícitamente el país.
 * NO acepta `''` ni "remoto"/"remote" a secas ni ubicaciones de otros países.
 */
export function isDominicanLocation(text: string | null | undefined): boolean {
  if (matchProvince(text)) return true;
  const n = normalizeText(text || '');
  return /\b(republica dominicana|dominican republic)\b/.test(n);
}

export function cityToProvince(citySlug: string | null | undefined): string | null {
  const c = CITY_DEFS.find((x) => x.slug === citySlug);
  return c && isRealProvince(c.provinceSlug) ? c.provinceSlug : null;
}

/** Extrae `{ province, city }` de los textos de ubicación disponibles. */
export function normalizeLocation(parts: {
  province?: string | null;
  city?: string | null;
  locationText?: string | null;
}): { province: string | null; city: string | null } {
  const city = canonicalCityName(parts.city) ?? null;
  let province =
    (isRealProvince(parts.province) ? parts.province! : null) ||
    matchProvince(parts.province) ||
    matchProvince(parts.city) ||
    matchProvince(parts.locationText);
  if (!province && city) province = cityToProvince(canonicalCityName(city) ? slugify(city) : null);
  return { province: province ?? null, city };
}

const slugify = (s: string) =>
  normalizeText(s).replace(/\s+/g, '-');

// ---------------- Categorías ----------------

/** Palabras clave → slug de `shared/job-categories.ts`. Orden = prioridad. */
const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ['tecnologia', /\b(desarrollad|program|software|full ?stack|frontend|backend|devops|qa|data|it|sistemas|redes|soporte t[eé]cnic)/i],
  ['ventas', /\b(vendedor|ventas|comercial|ejecutiv[oa] de cuenta|asesor comercial|representante de ventas)/i],
  ['atencion-al-cliente', /\b(atenci[oó]n al cliente|servicio al cliente|call ?center|contact center|customer|recepci[oó]n)/i],
  ['marketing', /\b(marketing|mercadeo|publicidad|community manager|seo|sem|redes sociales|brand)/i],
  ['diseno', /\b(dise[nñ]ador|dise[nñ]o gr[aá]fic|ux|ui|creativ|audiovisual|edici[oó]n de video)/i],
  ['contabilidad-finanzas', /\b(contador|contabilidad|finanzas|auditor|tesorer|cuentas por (pagar|cobrar)|anal[ií]sta financ)/i],
  ['recursos-humanos', /\b(recursos humanos|rrhh|reclutad|talento humano|n[oó]mina|capacitaci[oó]n)/i],
  ['legal', /\b(abogad|legal|jur[ií]dic|notari|paralegal)/i],
  ['salud', /\b(m[eé]dic|enfermer|odont|farmac|laboratori|bioanalist|salud|cl[ií]nic|hospital)/i],
  ['educacion', /\b(docente|profesor|maestr|educaci[oó]n|tutor|instructor acad[eé]mic)/i],
  ['turismo-hoteleria', /\b(hotel|hospitalidad|turismo|recepcionista de hotel|concierge|housekeeping|resort)/i],
  ['restaurantes', /\b(chef|cociner|mesero|camarer|bartender|restaurante|bar |repostero|steward)/i],
  ['construccion', /\b(ingenier[oi]a? civil|arquitect|construcci[oó]n|obra|albañil|maestro constructor|topograf)/i],
  ['produccion', /\b(producci[oó]n|manufactura|planta|operario de producci|ensamblaj|zona franca|maquila)/i],
  ['logistica-almacen', /\b(almac[eé]n|log[ií]stica|inventario|montacargas|despacho|supply chain|bodega)/i],
  ['transporte', /\b(chofer|conductor|motoconch|repartidor|delivery|transportista|mensajer)/i],
  ['seguridad', /\b(seguridad|vigilante|guardi[aá]n|oficial de seguridad|escolta)/i],
  ['oficios-mantenimiento', /\b(mantenimiento|electricist|plomer|refrigeraci[oó]n|mec[aá]nic|t[eé]cnic[oa] de|conserje|jardiner)/i],
  ['agricultura', /\b(agr[ií]cola|agropecuari|finca|cosecha|ganader|invernadero)/i],
  ['administracion', /\b(asistente administrativ|administraci[oó]n|secretari|auxiliar administrativ|oficinista|data entry|digitador)/i],
];

/** Mapea la categoría cruda de una fuente a un slug propio. Sin match seguro → `otros`. */
export function mapSourceCategory(raw: string | null | undefined, fallback = 'otros'): string {
  const r = (raw || '').trim();
  if (r && JOB_CATEGORY_SLUGS.includes(r)) return r;
  const hay = normalizeText(r);
  for (const [slug, re] of CATEGORY_KEYWORDS) {
    if (re.test(r) || re.test(hay)) return slug;
  }
  return JOB_CATEGORY_SLUGS.includes(fallback) ? fallback : 'otros';
}

// ---------------- Modalidad ----------------

/**
 * `remote` SOLO si la fuente dice explícitamente 100 % remoto / teletrabajo.
 * `hybrid` si menciona híbrido. Todo lo demás (incl. "home office ocasional") → `onsite`.
 */
export function detectWorkMode(...texts: (string | null | undefined)[]): 'onsite' | 'hybrid' | 'remote' {
  const t = normalizeText(texts.filter(Boolean).join(' '));
  if (!t) return 'onsite';
  if (/(hibrid|hybrid|semipresencial|semi.presencial)/.test(t)) return 'hybrid';
  const mentionsRemote =
    /(100% remoto|totalmente remoto|full remote|fully remote|trabajo remoto|teletrabajo|remote first|remoto desde|desde casa|work from home)/.test(
      t,
    ) || /\bremot[eo]\b/.test(t);
  if (mentionsRemote) {
    // "home office ocasional" / "algunos dias remoto" NO cuentan como remoto.
    if (/ocasional|algunos d[ií]as|puntual|esporadic|1 d[ií]a|un d[ií]a/.test(t)) return 'onsite';
    return 'remote';
  }
  return 'onsite';
}

// ---------------- Hash de contenido (dedup N4 / detección de cambios) ----------------

/**
 * Hash hexadecimal estable del contenido normalizado. No es criptográfico: sirve para
 * detectar duplicados aproximados y cambios materiales, no para seguridad.
 * FNV-1a de 64 bits (implementado con BigInt para portabilidad cliente/servidor).
 */
export function contentHash(job: {
  title: string;
  companyName: string;
  description?: string | null;
  city?: string | null;
  province?: string | null;
}): string {
  const basis = normalizeText(
    [job.title, job.companyName, job.description || '', job.city || job.province || ''].join(' | '),
  );
  const FNV_PRIME = 1099511628211n;
  const MASK = (1n << 64n) - 1n;
  let hash = 14695981039346656037n;
  for (let i = 0; i < basis.length; i++) {
    hash ^= BigInt(basis.charCodeAt(i) & 0xff);
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, '0');
}
