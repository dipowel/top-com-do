export { FX_USD_DOP, usdToDop, dopToUsd, formatDOP, formatUSD } from '@shared/fx';

export function relativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}
