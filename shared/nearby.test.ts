import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  nearbyScore,
  compareNearby,
  isValidLatLon,
  formatDistance,
  NEARBY_PROXIMITY_DECAY_KM,
} from './nearby';

const SD = { lat: 18.486, lon: -69.931 }; // Santo Domingo
const STGO = { lat: 19.451, lon: -70.697 }; // Santiago

describe('nearby · haversineKm', () => {
  it('Santo Domingo ↔ Santiago ≈ 134 km (gran círculo)', () => {
    const d = haversineKm(SD.lat, SD.lon, STGO.lat, STGO.lon);
    expect(d).toBeGreaterThan(128);
    expect(d).toBeLessThan(140);
  });

  it('un punto a sí mismo = 0', () => {
    expect(haversineKm(SD.lat, SD.lon, SD.lat, SD.lon)).toBeCloseTo(0, 6);
  });

  it('es simétrica', () => {
    expect(haversineKm(SD.lat, SD.lon, STGO.lat, STGO.lon)).toBeCloseTo(
      haversineKm(STGO.lat, STGO.lon, SD.lat, SD.lon),
      9,
    );
  });
});

describe('nearby · nearbyScore', () => {
  it('proximityScore sigue exp(-d/15) en escala 0–100', () => {
    const p = (km: number) => nearbyScore({ totalDop: 1, maxTotalDop: 1, distanceKm: km }).proximityScore;
    expect(p(0)).toBeCloseTo(100, 5);
    expect(p(5)).toBeCloseTo(71.65, 1);
    expect(p(10)).toBeCloseTo(51.34, 1);
    expect(p(NEARBY_PROXIMITY_DECAY_KM)).toBeCloseTo(36.79, 1);
    expect(p(30)).toBeCloseTo(13.53, 1);
    expect(p(50)).toBeCloseTo(3.57, 1);
  });

  it('finalScore siempre ∈ [0, 100]', () => {
    for (const totalDop of [0, 100, 1_000, 50_000, 10_000_000]) {
      for (const distanceKm of [0, 1, 15, 80, 500]) {
        const { finalScore } = nearbyScore({ totalDop, maxTotalDop: 10_000_000, distanceKm });
        expect(finalScore).toBeGreaterThanOrEqual(0);
        expect(finalScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('a distancia fija, más puja ⇒ mayor finalScore', () => {
    const s = (totalDop: number) =>
      nearbyScore({ totalDop, maxTotalDop: 10_000, distanceKm: 5 }).finalScore;
    expect(s(10_000)).toBeGreaterThan(s(3_000));
    expect(s(3_000)).toBeGreaterThan(s(500));
  });

  it('a puja fija, menos distancia ⇒ mayor finalScore', () => {
    const s = (distanceKm: number) =>
      nearbyScore({ totalDop: 3_000, maxTotalDop: 10_000, distanceKm }).finalScore;
    expect(s(0.5)).toBeGreaterThan(s(5));
    expect(s(5)).toBeGreaterThan(s(30));
  });

  it('escenario comercial del spec: A(10k,18km) B(3k,1km) C(1k,0.5km) → la cercanía reordena', () => {
    const maxTotalDop = 10_000;
    const scored = [
      { id: 'A', totalDop: 10_000, distanceKm: 18 },
      { id: 'B', totalDop: 3_000, distanceKm: 1 },
      { id: 'C', totalDop: 1_000, distanceKm: 0.5 },
    ].map((x) => ({ ...x, ...nearbyScore({ ...x, maxTotalDop }) }));
    scored.sort(compareNearby);
    const order = scored.map((x) => x.id);

    // Orden económico puro sería A,B,C. Con proximidad, B y C (muy cerca) suben:
    // A pasa a la cola pero por muy poco (los finalScore quedan apretados).
    expect(order).toEqual(['B', 'C', 'A']);
    const a = scored.find((s) => s.id === 'A')!;
    const b = scored.find((s) => s.id === 'B')!;
    expect(b.finalScore - a.finalScore).toBeLessThan(15); // no es un desplome, es un reorden
  });

  it('una puja verdaderamente dominante (100x) gana aunque esté lejos', () => {
    const maxTotalDop = 100_000;
    const scored = [
      { id: 'DOM', totalDop: 100_000, distanceKm: 30 },
      { id: 'NEAR', totalDop: 1_000, distanceKm: 0.5 },
    ].map((x) => ({ ...x, ...nearbyScore({ ...x, maxTotalDop }) }));
    scored.sort(compareNearby);
    expect(scored[0].id).toBe('DOM');
  });

  it('con un solo negocio, bidScore satura a 100 y no rompe', () => {
    const { bidScore, finalScore } = nearbyScore({ totalDop: 500, maxTotalDop: 500, distanceKm: 3 });
    expect(bidScore).toBeCloseTo(100, 5);
    expect(finalScore).toBeLessThanOrEqual(100);
  });
});

describe('nearby · compareNearby (empates deterministas)', () => {
  it('desempata por totalDop, luego distancia, luego id', () => {
    const a = { id: 'zzz', finalScore: 50, totalDop: 100, distanceKm: 2 };
    const b = { id: 'aaa', finalScore: 50, totalDop: 100, distanceKm: 2 };
    expect(compareNearby(a, b)).toBeGreaterThan(0); // 'aaa' antes que 'zzz'
    const c = { id: 'x', finalScore: 50, totalDop: 200, distanceKm: 9 };
    const d = { id: 'y', finalScore: 50, totalDop: 100, distanceKm: 1 };
    expect(compareNearby(c, d)).toBeLessThan(0); // más puja gana el empate de score
  });
});

describe('nearby · isValidLatLon', () => {
  it('acepta coordenadas de la RD', () => {
    expect(isValidLatLon(18.4, -69.9)).toBe(true);
  });
  it('rechaza fuera de rango o no finitas', () => {
    expect(isValidLatLon(91, 0)).toBe(false);
    expect(isValidLatLon(0, 181)).toBe(false);
    expect(isValidLatLon(NaN, 0)).toBe(false);
    expect(isValidLatLon(0, Infinity)).toBe(false);
  });
});

describe('nearby · formatDistance', () => {
  it('metros por debajo de 1 km, un decimal por encima', () => {
    expect(formatDistance(0.65)).toBe('650 m');
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(1.24)).toBe('1.2 km');
    expect(formatDistance(18.51)).toBe('18.5 km');
    expect(formatDistance(8.72)).toBe('8.7 km');
  });
  it('nunca devuelve decimales largos ni valores inválidos', () => {
    expect(formatDistance(1.23456789)).toBe('1.2 km');
    expect(formatDistance(-1)).toBe('');
    expect(formatDistance(NaN)).toBe('');
  });
});
