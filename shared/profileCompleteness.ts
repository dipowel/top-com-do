/**
 * Qué tan completo está el perfil de un negocio (0..100), para el ranking v2 (orgánico) y el
 * checklist "cómo subir en el ranking" (Fase 4). Puro — mismo patrón que `shared/rankScore.ts`.
 * ESPEJO: hay una copia en SQL de esta misma fórmula en `scripts/migrate-features.mjs` (el
 * backfill de los perfiles ya existentes) — si cambias los campos aquí, cámbialos allá también.
 */

export interface ProfileCompletenessInput {
  avatarUrl: string | null;
  bio: string | null;
  tagline: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  subcategory: string | null;
}

const hasText = (v: string | null | undefined): boolean => Boolean(v && v.trim().length > 0);

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/** Mismos 7 puntos que alimentan `computeProfileCompleteness` — para el checklist visual
 *  "cómo subir en el ranking" (Fase 4), con el nombre de cada punto en lenguaje llano. */
export function profileCompletenessChecklist(p: ProfileCompletenessInput): ChecklistItem[] {
  return [
    { key: 'logo', label: 'Sube el logo de tu negocio', done: hasText(p.avatarUrl) },
    { key: 'bio', label: 'Agrega una descripción', done: hasText(p.bio) },
    { key: 'tagline', label: 'Agrega una frase corta (tagline)', done: hasText(p.tagline) },
    { key: 'whatsapp', label: 'Agrega tu número de WhatsApp', done: hasText(p.whatsapp) },
    { key: 'social', label: 'Agrega Instagram o tu sitio web', done: hasText(p.instagramUrl) || hasText(p.websiteUrl) },
    { key: 'location', label: 'Marca tu ubicación en el mapa', done: hasText(p.address) && p.latitude != null && p.longitude != null },
    { key: 'subcategory', label: 'Elige una subcategoría', done: hasText(p.subcategory) },
  ];
}

export function computeProfileCompleteness(p: ProfileCompletenessInput): number {
  const checks = profileCompletenessChecklist(p);
  const score = (checks.filter((c) => c.done).length / checks.length) * 100;
  return Math.round(score);
}
