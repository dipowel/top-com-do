/**
 * Subasta dinámica: el usuario oferta un monto libre en RD$ que debe hacer que
 * el total acumulado de su negocio SUPERE al del #1 de su categoría × provincia.
 */
export const MIN_BID_DOP = 100;
export const BID_INCREMENT_DOP = 100;

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
