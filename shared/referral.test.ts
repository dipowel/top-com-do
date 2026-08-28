import { describe, it, expect } from 'vitest';
import { normalizeRefCode, extractRefCode } from './referral';

describe('normalizeRefCode', () => {
  it('limpia y valida códigos', () => {
    expect(normalizeRefCode('  abc123 ')).toBe('ABC123');
    expect(normalizeRefCode('DIPO4F9K')).toBe('DIPO4F9K');
  });
  it('rechaza basura', () => {
    expect(normalizeRefCode('')).toBeNull();
    expect(normalizeRefCode(null)).toBeNull();
    expect(normalizeRefCode('ab')).toBeNull(); // muy corto
    expect(normalizeRefCode('con espacio')).toBeNull();
    expect(normalizeRefCode('code!@#')).toBeNull();
    expect(normalizeRefCode('X'.repeat(25))).toBeNull(); // muy largo
  });
});

describe('extractRefCode', () => {
  it('lee ?ref= de la URL en cualquier ruta', () => {
    expect(extractRefCode('?ref=DIPO4F9K')).toBe('DIPO4F9K');
    expect(extractRefCode('ref=abc123&x=1')).toBe('ABC123');
    expect(extractRefCode('?utm=x&ref=Team9Q2P&t=2')).toBe('TEAM9Q2P');
  });
  it('devuelve null sin ref o con ref inválido', () => {
    expect(extractRefCode('')).toBeNull();
    expect(extractRefCode('?x=1')).toBeNull();
    expect(extractRefCode('?ref=')).toBeNull();
    expect(extractRefCode('?ref=no válido')).toBeNull();
  });
});
