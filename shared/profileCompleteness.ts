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

export function computeProfileCompleteness(p: ProfileCompletenessInput): number {
  const checks = [
    hasText(p.avatarUrl),
    hasText(p.bio),
    hasText(p.tagline),
    hasText(p.whatsapp),
    hasText(p.instagramUrl) || hasText(p.websiteUrl),
    hasText(p.address) && p.latitude != null && p.longitude != null,
    hasText(p.subcategory),
  ];
  const score = (checks.filter(Boolean).length / checks.length) * 100;
  return Math.round(score);
}
