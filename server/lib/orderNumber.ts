/**
 * ID de factura legible para una puja: mismo formato que ve el usuario en
 * `/recibo/:bidId` y el que se envía en el correo de recibo. Un solo lugar
 * para que ambos nunca puedan divergir.
 */
export function buildOrderNumber(bidId: string, createdAt: Date): string {
  const ymd = `${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, '0')}${String(createdAt.getDate()).padStart(2, '0')}`;
  return `TOP-${ymd}-${bidId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
