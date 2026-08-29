/**
 * Niveles fijos de puja (RD$). Cada nivel es un producto de precio fijo en el
 * panel de Dodo Payments, mapeado por la variable de entorno DODO_PRODUCT_<nivel>.
 */
export const BID_TIERS_DOP = [500, 1000, 2500, 5000] as const;

export type BidTier = (typeof BID_TIERS_DOP)[number];

export function isBidTier(n: unknown): n is BidTier {
  return typeof n === 'number' && (BID_TIERS_DOP as readonly number[]).includes(n);
}

/** El nivel más bajo que iguala o supera el monto necesario para liderar. */
export function tierToLead(neededDop: number): BidTier {
  return BID_TIERS_DOP.find((t) => t >= neededDop) ?? BID_TIERS_DOP[BID_TIERS_DOP.length - 1];
}
