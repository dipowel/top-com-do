/**
 * Taxonomía de categorías de EMPLEO (independiente de las 13 categorías de
 * negocio de `shared/categories.ts`). Cubre los sectores laborales más comunes
 * de la República Dominicana.
 */
export interface JobCategoryDef {
  slug: string;
  name: string;
}

export const JOB_CATEGORY_DEFS: JobCategoryDef[] = [
  { slug: 'administracion', name: 'Administración y Oficina' },
  { slug: 'ventas', name: 'Ventas y Comercial' },
  { slug: 'atencion-al-cliente', name: 'Atención al Cliente' },
  { slug: 'tecnologia', name: 'Tecnología e Informática' },
  { slug: 'marketing', name: 'Marketing y Publicidad' },
  { slug: 'diseno', name: 'Diseño y Creatividad' },
  { slug: 'contabilidad-finanzas', name: 'Contabilidad y Finanzas' },
  { slug: 'recursos-humanos', name: 'Recursos Humanos' },
  { slug: 'legal', name: 'Legal' },
  { slug: 'salud', name: 'Salud y Medicina' },
  { slug: 'educacion', name: 'Educación y Docencia' },
  { slug: 'turismo-hoteleria', name: 'Turismo y Hotelería' },
  { slug: 'restaurantes', name: 'Restaurantes y Gastronomía' },
  { slug: 'construccion', name: 'Construcción e Ingeniería' },
  { slug: 'produccion', name: 'Producción y Manufactura' },
  { slug: 'logistica-almacen', name: 'Logística y Almacén' },
  { slug: 'transporte', name: 'Transporte y Choferes' },
  { slug: 'seguridad', name: 'Seguridad y Vigilancia' },
  { slug: 'oficios-mantenimiento', name: 'Oficios y Mantenimiento' },
  { slug: 'agricultura', name: 'Agricultura y Agropecuaria' },
  { slug: 'otros', name: 'Otros' },
];

export const JOB_CATEGORY_SLUGS: string[] = JOB_CATEGORY_DEFS.map((c) => c.slug);

export function isJobCategory(slug: string | null | undefined): slug is string {
  return !!slug && JOB_CATEGORY_SLUGS.includes(slug);
}

export function jobCategoryLabel(slug: string | null | undefined): string {
  return JOB_CATEGORY_DEFS.find((c) => c.slug === slug)?.name ?? '';
}
