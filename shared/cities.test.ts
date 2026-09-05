import { describe, it, expect } from 'vitest';
import { citySlug, cityName, citiesForProvince, canonicalCityName, CITY_DEFS } from './cities';

describe('cities · lista curada de la RD', () => {
  it('todas las ciudades apuntan a un slug de provincia con guiones', () => {
    for (const c of CITY_DEFS) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.provinceSlug).toMatch(/^[a-z-]+$/);
    }
  });

  it('citySlug normaliza acentos y espacios', () => {
    expect(citySlug('Santiago de los Caballeros')).toBe('santiago-de-los-caballeros');
    expect(citySlug('Higüey')).toBe('higuey');
  });

  it('cityName resuelve el slug', () => {
    expect(cityName('punta-cana')).toBe('Punta Cana');
    expect(cityName('no-existe')).toBe('');
  });

  it('citiesForProvince filtra por provincia', () => {
    const la = citiesForProvince('la-altagracia').map((c) => c.name);
    expect(la).toContain('Punta Cana');
    expect(la).toContain('Bávaro');
    expect(la).not.toContain('Santiago de los Caballeros');
  });

  it('canonicalCityName mapea texto libre al nombre canónico', () => {
    expect(canonicalCityName('santiago de los caballeros')).toBe('Santiago de los Caballeros');
    expect(canonicalCityName('  PUNTA CANA ')).toBe('Punta Cana');
    expect(canonicalCityName('Mi Barrio X')).toBe('Mi Barrio X');
    expect(canonicalCityName('')).toBeUndefined();
  });
});
