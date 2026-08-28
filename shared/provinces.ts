/**
 * Demarcaciones de la República Dominicana: Distrito Nacional + 31 provincias.
 * `todo-rd` representa el ámbito nacional (sin filtro de provincia).
 */
export interface ProvinceDef {
  slug: string;
  name: string;
}

export const NATIONAL_SLUG = 'todo-rd';

export const PROVINCE_DEFS: ProvinceDef[] = [
  { slug: 'todo-rd', name: '🇩🇴 Todo RD' },
  { slug: 'distrito-nacional', name: 'Distrito Nacional' },
  { slug: 'azua', name: 'Azua' },
  { slug: 'baoruco', name: 'Baoruco' },
  { slug: 'barahona', name: 'Barahona' },
  { slug: 'dajabon', name: 'Dajabón' },
  { slug: 'duarte', name: 'Duarte' },
  { slug: 'el-seibo', name: 'El Seibo' },
  { slug: 'elias-pina', name: 'Elías Piña' },
  { slug: 'espaillat', name: 'Espaillat' },
  { slug: 'hato-mayor', name: 'Hato Mayor' },
  { slug: 'hermanas-mirabal', name: 'Hermanas Mirabal' },
  { slug: 'independencia', name: 'Independencia' },
  { slug: 'la-altagracia', name: 'La Altagracia' },
  { slug: 'la-romana', name: 'La Romana' },
  { slug: 'la-vega', name: 'La Vega' },
  { slug: 'maria-trinidad-sanchez', name: 'María Trinidad Sánchez' },
  { slug: 'monsenor-nouel', name: 'Monseñor Nouel' },
  { slug: 'monte-cristi', name: 'Monte Cristi' },
  { slug: 'monte-plata', name: 'Monte Plata' },
  { slug: 'pedernales', name: 'Pedernales' },
  { slug: 'peravia', name: 'Peravia' },
  { slug: 'puerto-plata', name: 'Puerto Plata' },
  { slug: 'samana', name: 'Samaná' },
  { slug: 'san-cristobal', name: 'San Cristóbal' },
  { slug: 'san-jose-de-ocoa', name: 'San José de Ocoa' },
  { slug: 'san-juan', name: 'San Juan' },
  { slug: 'san-pedro-de-macoris', name: 'San Pedro de Macorís' },
  { slug: 'sanchez-ramirez', name: 'Sánchez Ramírez' },
  { slug: 'santiago', name: 'Santiago' },
  { slug: 'santiago-rodriguez', name: 'Santiago Rodríguez' },
  { slug: 'valverde', name: 'Valverde' },
  { slug: 'santo-domingo', name: 'Santo Domingo' },
];

export const PROVINCE_SLUGS = PROVINCE_DEFS.map((p) => p.slug);

export function provinceName(slug: string | null | undefined): string {
  return PROVINCE_DEFS.find((p) => p.slug === slug)?.name ?? '';
}

export function isRealProvince(slug: string | null | undefined): slug is string {
  return Boolean(slug) && slug !== NATIONAL_SLUG && PROVINCE_SLUGS.includes(slug as string);
}
