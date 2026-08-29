import { createHash } from 'node:crypto';
import type { Request } from 'express';

const SALT = process.env.IP_SALT || process.env.CRON_SECRET || 'top-com-do-salt';

/**
 * Hash estable de la IP del cliente (nunca se guarda la IP en claro).
 * `trust proxy` ya está activo, así que `req.ip` es la IP real detrás de Vercel.
 */
export function clientIpHash(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return createHash('sha256').update(`${ip}::${SALT}`).digest('hex').slice(0, 32);
}
