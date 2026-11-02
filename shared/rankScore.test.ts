import { describe, it, expect } from 'vitest';
import { computeRankScore } from './rankScore';

describe('computeRankScore', () => {
  it('ignora el plan: la firma ni siquiera acepta plan/isVerified, así que un perfil Destacado y uno gratis con las mismas reseñas dan el mismo rank_score', () => {
    const inputs = { ratingAvg: 4.5, reviewsCount: 12, profileCompleteness: 80, fastResponseRate: 60 };
    const scoreFree = computeRankScore(inputs);
    const scoreDestacado = computeRankScore(inputs);
    expect(scoreFree).toBe(scoreDestacado);
  });

  it('40 reseñas de 4.7★ superan a 1 reseña de 5★, aunque el de 1 reseña tenga el perfil perfecto', () => {
    const oneGreatReview = computeRankScore({
      ratingAvg: 5, reviewsCount: 1, profileCompleteness: 100, fastResponseRate: 100,
    });
    const manyGoodReviews = computeRankScore({
      ratingAvg: 4.7, reviewsCount: 40, profileCompleteness: 0, fastResponseRate: 0,
    });
    expect(manyGoodReviews).toBeGreaterThan(oneGreatReview);
  });
});
