/**
 * Lista curada de ciudades/municipios de mayor demanda comercial de la República
 * Dominicana. Sirve para normalizar el campo libre `profiles.city` hacia un nombre
 * canónico (mejora `addressLocality` en los datos estructurados y prepara futuras
 * landings por ciudad). NO define rutas todavía: la capa de URLs sigue en provincia.
 */
export interface CityDef {
  slug: string;
  name: string;
  /** slug de provincia de `shared/provinces.ts` a la que pertenece. */
  provinceSlug: string;
}

export const CITY_DEFS: CityDef[] = [
  // Gran Santo Domingo
  { slug: 'distrito-nacional', name: 'Santo Domingo (Distrito Nacional)', provinceSlug: 'distrito-nacional' },
  { slug: 'santo-domingo-este', name: 'Santo Domingo Este', provinceSlug: 'santo-domingo' },
  { slug: 'santo-domingo-norte', name: 'Santo Domingo Norte', provinceSlug: 'santo-domingo' },
  { slug: 'santo-domingo-oeste', name: 'Santo Domingo Oeste', provinceSlug: 'santo-domingo' },
  { slug: 'boca-chica', name: 'Boca Chica', provinceSlug: 'santo-domingo' },
  { slug: 'los-alcarrizos', name: 'Los Alcarrizos', provinceSlug: 'santo-domingo' },
  // Cibao
  { slug: 'santiago-de-los-caballeros', name: 'Santiago de los Caballeros', provinceSlug: 'santiago' },
  { slug: 'tamboril', name: 'Tamboril', provinceSlug: 'santiago' },
  { slug: 'la-vega', name: 'La Vega', provinceSlug: 'la-vega' },
  { slug: 'jarabacoa', name: 'Jarabacoa', provinceSlug: 'la-vega' },
  { slug: 'constanza', name: 'Constanza', provinceSlug: 'la-vega' },
  { slug: 'san-francisco-de-macoris', name: 'San Francisco de Macorís', provinceSlug: 'duarte' },
  { slug: 'moca', name: 'Moca', provinceSlug: 'espaillat' },
  { slug: 'bonao', name: 'Bonao', provinceSlug: 'monsenor-nouel' },
  { slug: 'cotui', name: 'Cotuí', provinceSlug: 'sanchez-ramirez' },
  { slug: 'nagua', name: 'Nagua', provinceSlug: 'maria-trinidad-sanchez' },
  // Norte / costa
  { slug: 'puerto-plata', name: 'Puerto Plata', provinceSlug: 'puerto-plata' },
  { slug: 'sosua', name: 'Sosúa', provinceSlug: 'puerto-plata' },
  { slug: 'cabarete', name: 'Cabarete', provinceSlug: 'puerto-plata' },
  { slug: 'mao', name: 'Mao', provinceSlug: 'valverde' },
  { slug: 'esperanza', name: 'Esperanza', provinceSlug: 'valverde' },
  { slug: 'monte-cristi', name: 'Monte Cristi', provinceSlug: 'monte-cristi' },
  { slug: 'samana', name: 'Samaná', provinceSlug: 'samana' },
  { slug: 'las-terrenas', name: 'Las Terrenas', provinceSlug: 'samana' },
  // Este
  { slug: 'la-romana', name: 'La Romana', provinceSlug: 'la-romana' },
  { slug: 'higuey', name: 'Higüey', provinceSlug: 'la-altagracia' },
  { slug: 'punta-cana', name: 'Punta Cana', provinceSlug: 'la-altagracia' },
  { slug: 'bavaro', name: 'Bávaro', provinceSlug: 'la-altagracia' },
  { slug: 'veron', name: 'Verón', provinceSlug: 'la-altagracia' },
  { slug: 'san-pedro-de-macoris', name: 'San Pedro de Macorís', provinceSlug: 'san-pedro-de-macoris' },
  { slug: 'hato-mayor', name: 'Hato Mayor', provinceSlug: 'hato-mayor' },
  { slug: 'el-seibo', name: 'El Seibo', provinceSlug: 'el-seibo' },
  // Sur
  { slug: 'san-cristobal', name: 'San Cristóbal', provinceSlug: 'san-cristobal' },
  { slug: 'villa-altagracia', name: 'Villa Altagracia', provinceSlug: 'san-cristobal' },
  { slug: 'bani', name: 'Baní', provinceSlug: 'peravia' },
  { slug: 'azua', name: 'Azua', provinceSlug: 'azua' },
  { slug: 'barahona', name: 'Barahona', provinceSlug: 'barahona' },
  { slug: 'san-juan', name: 'San Juan de la Maguana', provinceSlug: 'san-juan' },
];

export const CITY_NAMES: string[] = CITY_DEFS.map((c) => c.name);

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function citySlug(name: string): string {
  return norm(name).replace(/\s+/g, '-') || 'ciudad';
}

export function cityName(slug: string | null | undefined): string {
  return CITY_DEFS.find((c) => c.slug === slug)?.name ?? '';
}

export function citiesForProvince(provinceSlug: string | null | undefined): CityDef[] {
  if (!provinceSlug) return CITY_DEFS;
  return CITY_DEFS.filter((c) => c.provinceSlug === provinceSlug);
}

/**
 * Devuelve el nombre canónico si el texto libre casa (sin acentos ni mayúsculas)
 * con una ciudad conocida; si no, devuelve el original recortado.
 */
export function canonicalCityName(input: string | null | undefined): string | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;
  const n = norm(raw);
  const hit = CITY_DEFS.find((c) => norm(c.name) === n || c.slug === n.replace(/\s+/g, '-'));
  return hit ? hit.name : raw.slice(0, 60);
}
