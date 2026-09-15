import { describe, it, expect } from 'vitest';
import { buildOrderNumber } from './orderNumber';

describe('buildOrderNumber', () => {
  it('genera TOP-YYYYMMDD-<6 primeros del id en mayúsculas>', () => {
    const id = 'a1b2c3d4-0000-0000-0000-000000000000';
    const created = new Date('2026-09-07T14:32:00-04:00');
    expect(buildOrderNumber(id, created)).toBe('TOP-20260907-A1B2C3');
  });
});
