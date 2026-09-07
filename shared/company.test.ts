import { describe, it, expect } from 'vitest';
import { COMPANY } from './company';

describe('company · identidad del comercio (AZUL)', () => {
  it('tiene todos los campos obligatorios no vacíos', () => {
    expect(COMPANY.legalName.length).toBeGreaterThan(3);
    expect(COMPANY.taxId).toMatch(/\d/);
    expect(COMPANY.address.full).toContain('República Dominicana');
    expect(COMPANY.supportEmail).toMatch(/@/);
    expect(COMPANY.hours.length).toBeGreaterThan(3);
  });

  it('el teléfono está en formato E.164', () => {
    expect(COMPANY.phone).toMatch(/^\+\d{10,15}$/);
  });

  it('la pasarela es AZUL', () => {
    expect(COMPANY.paymentGateway).toBe('AZUL');
    expect(COMPANY.paymentGatewayLegal).toContain('AZUL');
  });
});
