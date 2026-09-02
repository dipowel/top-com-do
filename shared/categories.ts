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
    subcategories: [
      'Pica Pollos',
      'Comida Criolla',
      'Reposterías y Panaderías',
      'Comida Rápida / Delivery',
      'Cafeterías',
      'Heladerías',
      'Liquor Stores y Drinks',
      'Colmados Premium',
      'Carnicerías y Surtidos',
      'Pescaderías y Marisquerías',
      'Supermercados y Minimarkets',
      'Pizzerías y Comida Italiana',
      'Comida China y Pica Pollos',
    ],
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
      'Importadoras de Vehículos / Navieras',
      'Grúas 24h y Trámite de Placas',
      'Seguros y Marbetes',
      'Pintura y Detallado (Body Shop / Wrapping)',
      'Baterías y Accesorios',
      'Lubricentros y Cambios de Aceite',
      'Aire Acondicionado Automotriz',
      'Cristales y Vidrios para Vehículos',
      'Gasolineras y Estaciones de Servicio',
    ],
  },
  {
    slug: 'tecnologia',
    name: '📱 Tecnología y Electrónica',
    sortOrder: 3,
    subcategories: [
      'Tiendas de Celulares / iPhones',
      'Reparación de Dispositivos',
      'Informática y Gadgets',
      'Electrodomésticos y Línea Blanca',
      'Cámaras, Seguridad y Domótica',
      'Consolas, Videojuegos y Gaming',
      'Audio, Sonido e Iluminación Profesional',
    ],
  },
  {
    slug: 'hogar',
    name: '🏠 Hogar y Ferreterías',
    sortOrder: 4,
    subcategories: [
      'Ferreterías',
      'Mueblerías y Tiendas de Hogar',
      'Plomería y Electricidad',
      'Constructoras, Contratistas y Arquitectos',
      'Alquiler de Plantas Eléctricas y Equipos',
      'Pinturas e Impermeabilizantes',
      'Diseño de Interiores y Cortinas',
      'Jardinería, Viveros y Paisajismo',
      'Cerámicas, Pisos y Baños',
    ],
  },
  {
    slug: 'moda-belleza',
    name: '💈 Moda y Belleza',
    sortOrder: 5,
    subcategories: [
      'Salones de Belleza y Barbershops',
      'Boutiques y Joyerías',
      'Calzado y Ropa',
      'Spas y Centros de Estética',
      'Uñas y Maquillaje (Nail Bars)',
      'Ópticas y Salud Visual',
      'Perfumerías y Cosméticos',
    ],
  },
  {
    slug: 'salud',
    name: '🩺 Salud y Bienestar',
    sortOrder: 6,
    subcategories: [
      'Farmacias 24h',
      'Clínicas y Centros Médicos',
      'Centros de Estética',
      'Laboratorios Clínicos y Centros de Referencia',
      'Ópticas y Examen Visual',
      'Consultorios Odontológicos / Clínicas Dentales',
      'Gimnasios y Centros de Fitness',
    ],
  },
  {
    slug: 'servicios',
    name: '💼 Servicios Profesionales',
    sortOrder: 7,
    subcategories: [
      'Abogados y Notarios',
      'Contabilidad y Gestorías',
      'Centros de Eventos y Bodas',
      'Prestamistas, Financieras y Cooperativas',
      'Agencias de Viajes y Visas',
    ],
  },
  {
    slug: 'inmobiliaria',
    name: '🏢 Inmobiliaria y Bienes Raíces',
    sortOrder: 8,
    subcategories: [
      'Inmobiliarias y Alquileres',
      'Corredores y Agentes Independientes',
      'Alquileres de Temporada y Villas',
      'Hoteles, Villas y Cabañas',
      'Tasación y Peritaje Inmobiliario',
      'Administración de Condominios y Propiedades',
    ],
  },
  {
    slug: 'politica',
    name: '🏛️ Política y Movimientos',
    sortOrder: 9,
    subcategories: ['Figuras y Candidatos', 'Alcaldías', 'Movimientos y Partidos'],
  },
  {
    slug: 'ocio',
    name: '🎉 Ocio, Discotecas y Lounge',
    sortOrder: 10,
    subcategories: [
      'Discotecas y Lounge',
      'Bares y Terrazas',
      'Billares y Sport Bar',
      'Drink Shops y Colmadones VIP',
      'Karaokes y Centros de Entretenimiento',
      'Hookah Lounges y Terrazas',
      'Clubes Nocturnos y Centros de Conciertos',
    ],
  },
  {
    slug: 'educacion',
    name: '🎓 Educación y Academias',
    sortOrder: 11,
    subcategories: [
      'Universidades e Institutos',
      'Academias de Idiomas',
      'Escuelas de Conducción',
      'Cursos Técnicos',
    ],
  },
  {
    slug: 'mascotas',
    name: '🐾 Mascotas y Veterinarias',
    sortOrder: 12,
    subcategories: ['Clínicas Veterinarias', 'Pet Shops y Alimentos', 'Peluquería Canina (Grooming)'],
  },
];

export const CATEGORY_SLUGS = CATEGORY_DEFS.map((c) => c.slug);
export const CATCH_ALL_SLUG = 'servicios';

/** Categorías reales (sin el ranking general `todo-rd`). */
export const REAL_CATEGORY_DEFS = CATEGORY_DEFS.filter((c) => c.slug !== 'todo-rd');

export function subcategoriesFor(slug: string): string[] {
  return CATEGORY_DEFS.find((c) => c.slug === slug)?.subcategories ?? [];
}

// ---------------- Subcategorías (para rutas y SEO) ----------------

/** Slug URL-safe a partir del nombre de una subcategoría. */
export function subSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'general'
  );
}

export interface SubcategoryDef {
  categorySlug: string;
  slug: string;
  label: string;
}

export const SUBCATEGORY_DEFS: SubcategoryDef[] = CATEGORY_DEFS.flatMap((c) =>
  c.subcategories.map((label) => ({ categorySlug: c.slug, slug: subSlug(label), label })),
);

/** Subcategorías de una categoría con su slug de URL. */
export function subcategoriesWithSlugsFor(categorySlug: string): { slug: string; label: string }[] {
  return SUBCATEGORY_DEFS.filter((s) => s.categorySlug === categorySlug).map((s) => ({
    slug: s.slug,
    label: s.label,
  }));
}

/** Etiqueta legible de una subcategoría a partir de (categoría, slug). */
export function subcategoryLabel(
  categorySlug: string | null | undefined,
  slug: string | null | undefined,
): string {
  return (
    SUBCATEGORY_DEFS.find((s) => s.categorySlug === categorySlug && s.slug === slug)?.label ?? ''
  );
}
