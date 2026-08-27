import { describe, it, expect } from 'vitest';
import { FX_USD_DOP, usdToDop, dopToUsd } from './fx';

describe('conversion de divisas', () => {
  it('usa la tasa fija 1 USD = 59.50 DOP', () => {
    expect(FX_USD_DOP).toBe(59.5);
    expect(usdToDop(1)).toBe(59.5);
    expect(usdToDop(10)).toBe(595);
  });

  it('convierte DOP a USD de ida y vuelta', () => {
    expect(dopToUsd(595)).toBe(10);
    expect(usdToDop(dopToUsd(1190))).toBeCloseTo(1190, 1);
  });
});
