import { Router } from 'express';
import { ah } from '../lib/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { getRankings, getNearbyRankings } from '../lib/rankings';
import { isValidLatLon } from '../../shared/nearby';

const r = Router();

const clampLimit = (v: unknown): number => Math.min(Math.max(Number(v) || 100, 1), 250);
const strParam = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

r.get(
  '/',
  ah(async (req, res) => {
    const category = strParam(req.query.category);
    const province = strParam(req.query.province);
    const data = await getRankings(category, province, clampLimit(req.query.limit));
    res.json(data);
  }),
);

/**
 * Modo "Cerca de mí": mismo ranking, re-ordenado por puja + proximidad respecto a
 * las coordenadas del navegador. Personalizado por usuario → `noStore` global
 * impide que se cachee (nunca en `sitemap`, nunca enlazado en HTML rastreable).
 */
r.get(
  '/nearby',
  ah(async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!isValidLatLon(lat, lon)) {
      throw new HttpError(400, 'Coordenadas inválidas');
    }
    const category = strParam(req.query.category);
    const province = strParam(req.query.province);
    const data = await getNearbyRankings(lat, lon, category, province, clampLimit(req.query.limit));
    res.json(data);
  }),
);

export default r;
