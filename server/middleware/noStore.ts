import type { Request, Response, NextFunction } from 'express';

/**
 * Fuerza respuestas sin caché en toda la API para que cualquier visitante
 * (incluido modo incógnito) reciba siempre los datos reales de la base de datos.
 * Evita problemas de caché de Vercel / CDN.
 */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
