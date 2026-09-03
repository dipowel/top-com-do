import { useAuth } from './useAuth';

/**
 * ¿Este usuario es comerciante o participante de la subasta? Gobierna toda la UI
 * de pujas (botones "Pujar por X", "Recuperar #1", secciones de apoyo, etc.).
 * El consumidor general no ve esas herramientas; sí ve montos, totales y posiciones.
 */
export function useAuctionAccess(): boolean {
  const { isAdmin, accountType, me } = useAuth();
  return isAdmin || accountType === 'merchant' || Boolean(me?.hasBids);
}
