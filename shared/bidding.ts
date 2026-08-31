/**
 * Subasta dinámica: el usuario oferta un monto libre en RD$ que debe hacer que
 * el total acumulado de su negocio SUPERE al del #1 de su categoría × provincia.
 */
export const MIN_BID_DOP = 100;
export const BID_INCREMENT_DOP = 100;

/**
 * El ranking usa una VENTANA MÓVIL: el puesto de un negocio = suma de sus pujas
 * verificadas en los últimos N días. No hay reinicio semanal de golpe; cada puja
 * "envejece" y deja de contar sola al cumplir la ventana, así que el que deja de
 * pujar baja día a día y un competidor lo pasa.
 */
export const RANKING_WINDOW_DAYS = 7;

/** Inicio de la ventana de ranking (ahora − N días). */
export function rankingWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RANKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** Oferta mínima para que un negocio supere al #1 de su ámbito. */
export function minNextBid(opts: {
  leaderTotalDop: number;
  myTotalDop: number;
  iAmLeader: boolean;
}): number {
  if (opts.iAmLeader) return MIN_BID_DOP;
  const need = opts.leaderTotalDop - opts.myTotalDop + BID_INCREMENT_DOP;
  return Math.max(need, MIN_BID_DOP);
}

/** Convierte un monto en RD$ a la mínima denominación (centavos) que espera Dodo. */
export const toLowestDenomination = (dop: number): number => Math.round(dop * 100);
