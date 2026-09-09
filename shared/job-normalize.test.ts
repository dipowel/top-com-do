import { describe, it, expect } from 'vitest';
import {
  matchProvince,
  cityToProvince,
  normalizeLocation,
  mapSourceCategory,
  detectWorkMode,
  contentHash,
} from './job-normalize';

describe('job-normalize · ubicación', () => {
  it('matchProvince reconoce nombres y municipios', () => {
    expect(matchProvince('Distrito Nacional')).toBe('distrito-nacional');
    expect(matchProvince('Santiago de los Caballeros')).toBe('santiago');
    expect(matchProvince('Boca Chica')).toBe('santo-domingo');
    expect(matchProvince('Ciudad de Panamá')).toBeNull();
  });

  it('cityToProvince mapea el slug de ciudad a su provincia', () => {
    expect(cityToProvince('la-romana')).toBe('la-romana');
    expect(cityToProvince('inexistente')).toBeNull();
  });

  it('normalizeLocation deduce provincia desde el texto libre sin inventar', () => {
    expect(normalizeLocation({ locationText: 'Trabajo en Santo Domingo Este' }).province).toBe('santo-domingo');
    expect(normalizeLocation({ city: 'Higüey' }).province).toBe('la-altagracia');
    expect(normalizeLocation({ locationText: 'remoto' }).province).toBeNull();
  });
});

describe('job-normalize · categoría', () => {
  it('mapea por palabras clave', () => {
    expect(mapSourceCategory('Desarrollador Backend Node')).toBe('tecnologia');
    expect(mapSourceCategory('Ejecutivo de Ventas')).toBe('ventas');
    expect(mapSourceCategory('Chofer categoría 4')).toBe('transporte');
    expect(mapSourceCategory('Enfermera general')).toBe('salud');
  });
  it('respeta un slug ya válido y cae a otros si no hay match', () => {
    expect(mapSourceCategory('tecnologia')).toBe('tecnologia');
    expect(mapSourceCategory('xyzzy sin sentido')).toBe('otros');
  });
});

describe('job-normalize · modalidad', () => {
  it('remoto solo si es explícito', () => {
    expect(detectWorkMode('100% remoto')).toBe('remote');
    expect(detectWorkMode('Trabajo remoto / teletrabajo')).toBe('remote');
    expect(detectWorkMode('Híbrido, 2 días en oficina')).toBe('hybrid');
    expect(detectWorkMode('Presencial en Santiago')).toBe('onsite');
    expect(detectWorkMode('con home office ocasional')).toBe('onsite');
    expect(detectWorkMode('')).toBe('onsite');
  });
});

describe('job-normalize · contentHash', () => {
  it('es estable y sensible al contenido', () => {
    const a = contentHash({ title: 'Cajero', companyName: 'ACME', description: 'Atender caja', city: 'Santiago' });
    const b = contentHash({ title: '  cajero ', companyName: 'acme', description: 'Atender caja', city: 'SANTIAGO' });
    const c = contentHash({ title: 'Cajero', companyName: 'ACME', description: 'Otra cosa', city: 'Santiago' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});
