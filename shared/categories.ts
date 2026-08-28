/**
 * Categorías oficiales de Top.com.do (directorio de autoridad de RD).
 * `todo-rd` es el ranking general. El resto son las pestañas del mercado dominicano.
 */
export interface CategoryDef {
  slug: string;
  name: string;
  sortOrder: number;
  subcategories: string[];
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { slug: 'todo-rd', name: '🔥 Todo RD', sortOrder: 0, subcategories: [] },
  {
    slug: 'gastronomia',
    name: '🍗 Gastronomía y Comida',
    sortOrder: 1,
    subcategories: ['Pica Pollos', 'Comida Criolla', 'Reposterías y Panaderías', 'Comida Rápida / Delivery'],
  },
  {
    slug: 'automotriz',
    name: '🔧 Automotriz y Talleres',
    sortOrder: 2,
    subcategories: [
      'Talleres de Mecánica',
      'Repuestos y Autoadornos',
      'Gomeras y Alineación',
      'Dealers de Vehículos',
      'Rent a Car',
    ],
  },
  {
    slug: 'tecnologia',
    name: '📱 Tecnología y Electrónica',
    sortOrder: 3,
    subcategories: ['Tiendas de Celulares / iPhones', 'Reparación de Dispositivos', 'Informática y Gadgets'],
  },
  {
    slug: 'hogar',
    name: '🏠 Hogar y Ferreterías',
    sortOrder: 4,
    subcategories: ['Ferreterías', 'Mueblerías y Tiendas de Hogar', 'Plomería y Electricidad'],
  },
  {
    slug: 'moda-belleza',
    name: '💈 Moda y Belleza',
    sortOrder: 5,
    subcategories: ['Salones de Belleza y Barbershops', 'Boutiques y Joyerías', 'Calzado y Ropa'],
  },
  {
    slug: 'salud',
    name: '🩺 Salud y Bienestar',
    sortOrder: 6,
    subcategories: ['Farmacias 24h', 'Clínicas y Centros Médicos', 'Centros de Estética'],
  },
  {
    slug: 'servicios',
    name: '💼 Servicios e Inmobiliaria',
    sortOrder: 7,
    subcategories: [
      'Inmobiliarias y Alquileres',
      'Abogados y Notarios',
      'Contabilidad y Gestorías',
    ],
  },
  {
    slug: 'politica',
    name: '🏛️ Política y Movimientos',
    sortOrder: 8,
    subcategories: ['Figuras y Candidatos', 'Alcaldías', 'Movimientos y Partidos'],
  },
];

export const CATEGORY_SLUGS = CATEGORY_DEFS.map((c) => c.slug);
export const CATCH_ALL_SLUG = 'servicios';

export function subcategoriesFor(slug: string): string[] {
  return CATEGORY_DEFS.find((c) => c.slug === slug)?.subcategories ?? [];
}
