import { describe, it, expect } from 'vitest';
import { summarize, isValidRating } from './reviews';

describe('summarize', () => {
  it('promedia y distribuye', () => {
    const s = summarize([5, 5, 4, 3, 1]);
    expect(s.count).toBe(5);
    expect(s.average).toBe(3.6);
    expect(s.distribution).toEqual({ '1': 1, '2': 0, '3': 1, '4': 1, '5': 2 });
  });
  it('lista vacía → 0', () => {
    expect(summarize([])).toEqual({
      average: 0,
      count: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
  });
});

describe('isValidRating', () => {
  it('acepta 1..5 enteros', () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
  });
  it('rechaza fuera de rango o no enteros', () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
    expect(isValidRating('4')).toBe(false);
  });
});
