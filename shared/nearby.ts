/**
 * Modo de ranking "📍 Cerca de mí": re-ordena los MISMOS negocios que el ranking
 * económico combinando puja (70 %) y proximidad (30 %). Módulo puro (sin DOM, sin
 * SQL): es el oráculo de los tests y el espejo de la consulta de `getNearbyRankings`.
 * El ranking económico (`getRankings`) NO usa nada de esto.
 */

export const NEARBY_BID_WEIGHT = 0.7;
export const NEARBY_PROXIMITY_WEIGHT = 0.3;
/** Único lugar donde vive la constante de decaimiento de la proximidad (km). */
export const NEARBY_PROXIMITY_DECAY_KM = 15;

/** Radio medio de la Tierra en km (haversine). */
export const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function isValidLatLon(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Distancia en km entre dos puntos (haversine). Precisión < 0,3 % a escala RD. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface NearbyScore {
  /** Componente de puja, escala 0–100. */
  bidScore: number;
  /** Componente de proximidad, escala 0–100. */
  proximityScore: number;
  /** Score final ponderado, escala 0–100. */
  finalScore: number;
}

/**
 * Score híbrido. `maxTotalDop` = mayor total de puja dentro del conjunto de
 * resultados (no global) — así la ventaja relativa de la puja es comparable.
 */
export function nearbyScore(opts: {
  totalDop: number;
  maxTotalDop: number;
  distanceKm: number;
}): NearbyScore {
  const total = Math.max(opts.totalDop, 0);
  const maxTotal = Math.max(opts.maxTotalDop, 1);
  const dist = Math.max(opts.distanceKm, 0);

  // Normalización logarítmica: una puja dominante conserva ventaja sin que las
  // diferencias extremas aplasten el componente de proximidad.
  const bidScoreN = Math.log(1 + total) / Math.max(Math.log(1 + maxTotal), Math.log(2));
  // Rendimientos decrecientes: 0 km → 1, 15 km → ~0.37, 50 km → ~0.036.
  const proximityScoreN = Math.exp(-dist / NEARBY_PROXIMITY_DECAY_KM);

  const finalScore =
    100 * (NEARBY_BID_WEIGHT * bidScoreN + NEARBY_PROXIMITY_WEIGHT * proximityScoreN);

  return {
    bidScore: Math.min(100, bidScoreN * 100),
    proximityScore: proximityScoreN * 100,
    finalScore: Math.min(100, Math.max(0, finalScore)),
  };
}

/**
 * Comparador determinista para el modo cercano. Debe coincidir con el `ORDER BY`
 * de `getNearbyRankings`: final_score DESC, total_dop DESC, distance_km ASC, id ASC.
 */
export function compareNearby(
  a: { finalScore: number; totalDop: number; distanceKm: number; id: string },
  b: { finalScore: number; totalDop: number; distanceKm: number; id: string },
): number {
  return (
    b.finalScore - a.finalScore ||
    b.totalDop - a.totalDop ||
    a.distanceKm - b.distanceKm ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Distancia amigable para humanos: `< 1 km` → metros; `≥ 1 km` → un decimal. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const m = Math.round(km * 1000);
    return `${m} m`;
  }
  return `${km.toFixed(1)} km`;
}
