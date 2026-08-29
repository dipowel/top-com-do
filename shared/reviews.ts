import type { ReviewSummary } from './types';

export const REVIEW_MIN = 1;
export const REVIEW_MAX = 5;
export const REVIEW_COMMENT_MAX = 600;

/** Promedio (1 decimal) y distribución 1..5 a partir de una lista de ratings. */
export function summarize(ratings: number[]): ReviewSummary {
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as ReviewSummary['distribution'];
  let sum = 0;
  for (const r of ratings) {
    const n = Math.min(REVIEW_MAX, Math.max(REVIEW_MIN, Math.round(r)));
    distribution[String(n) as keyof ReviewSummary['distribution']] += 1;
    sum += n;
  }
  const count = ratings.length;
  const average = count ? Math.round((sum / count) * 10) / 10 : 0;
  return { average, count, distribution };
}

export function isValidRating(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= REVIEW_MIN && n <= REVIEW_MAX;
}
