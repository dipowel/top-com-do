/**
 * Tasa de cambio fija para pagos internacionales.
 * 1 USD = 59.50 DOP (definida por el negocio, sin llamadas a APIs externas).
 */
export const FX_USD_DOP = 59.5;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function usdToDop(usd: number): number {
  return round2(usd * FX_USD_DOP);
}

export function dopToUsd(dop: number): number {
  return round2(dop / FX_USD_DOP);
}

export function formatDOP(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
}
