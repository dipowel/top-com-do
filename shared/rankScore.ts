/**
 * Ranking v2 (orgánico, basado en reseñas) — Fase 1 de la migración fuera del modelo de pujas.
 * Puro, sin base de datos (mismo patrón que `shared/bidding.ts`/`shared/nearby.ts`), para poder
 * testearlo sin infraestructura. El plan pagado (Verificado/Destacado) NUNCA entra aquí — esta
 * firma ni siquiera acepta `plan`/`isVerified` como parámetro, a propósito.
 */

/** "Votos" fantasma del prior bayesiano — entre más alto, más le cuesta a pocas reseñas mover el promedio. */
export const RANK_PRIOR_WEIGHT = 10;
/** Promedio neutro de partida (1..5) para un negocio sin ninguna reseña. */
export const RANK_PRIOR_RATING = 4.0;

export const RANK_WEIGHT_RATING = 95;
export const RANK_WEIGHT_COMPLETENESS = 3;
export const RANK_WEIGHT_FAST_RESPONSE = 2;
// 95 + 3 + 2 = 100 → rank_score siempre cae en [0, 100].

/** Promedio bayesiano: mezcla el promedio real con el prior según cuántas reseñas haya. */
export function bayesianRatingAvg(ratingAvg: number, reviewsCount: number): number {
  return (
    (RANK_PRIOR_WEIGHT * RANK_PRIOR_RATING + reviewsCount * ratingAvg) /
    (RANK_PRIOR_WEIGHT + reviewsCount)
  );
}

export interface RankScoreInput {
  ratingAvg: number;
  reviewsCount: number;
  /** 0..100 */
  profileCompleteness: number;
  /** 0..100 */
  fastResponseRate: number;
}

/** `rank_score` 0..100. Con 95% de peso en la calificación, los bonos de perfil/rapidez nunca
 *  pueden voltear el orden entre un negocio con historial real y uno sin él. */
export function computeRankScore(input: RankScoreInput): number {
  const bayes = bayesianRatingAvg(input.ratingAvg, input.reviewsCount);
  const score =
    RANK_WEIGHT_RATING * (bayes / 5) +
    RANK_WEIGHT_COMPLETENESS * (input.profileCompleteness / 100) +
    RANK_WEIGHT_FAST_RESPONSE * (input.fastResponseRate / 100);
  return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100;
}
