import { eq } from 'drizzle-orm';
import { db } from '../db';
import { settings } from '../../shared/schema';

const DEFAULTS: Record<string, string> = {
  plan_verificado_price_dop: '500',
  plan_destacado_price_dop: '1500',
  job_urgent_price_dop: '500',
};

export async function getSetting(key: string): Promise<string> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? DEFAULTS[key] ?? '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export interface PlanPrices {
  verificado: number;
  destacado: number;
}

/** Precios vigentes (RD$/mes) — editables desde el admin, nunca fijos en el código. */
export async function getPlanPrices(): Promise<PlanPrices> {
  const [verificado, destacado] = await Promise.all([
    getSetting('plan_verificado_price_dop'),
    getSetting('plan_destacado_price_dop'),
  ]);
  return { verificado: Number(verificado) || 500, destacado: Number(destacado) || 1500 };
}
