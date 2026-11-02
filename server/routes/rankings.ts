import { Router } from 'express';
import { ah } from '../lib/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { getActiveRankings, getActiveNearbyRankings, isNewModelEnabled } from '../lib/rankingModel';
import { getFeaturedProfiles } from '../lib/rankingsOrganic';
import { isValidLatLon } from '../../shared/nearby';

const r = Router();

const clampLimit = (v: unknown): number => Math.min(Math.max(Number(v) || 100, 1), 250);
const strParam = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Público, sin auth: para que el cliente sepa qué ranking está activo (reseñas o pujas) y
 *  ajuste la interfaz — nunca el servidor decide por el flag que llega del cliente, solo al
 *  revés. */
r.get(
  '/model',
  ah(async (_req, res) => {
    res.json({ newModel: isNewModelEnabled() });
  }),
);

r.get(
  '/',
  ah(async (req, res) => {
    const category = strParam(req.query.category);
    const province = strParam(req.query.province);
    const data = await getActiveRankings(category, province, clampLimit(req.query.limit));
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
    const data = await getActiveNearbyRankings(lat, lon, category, province, clampLimit(req.query.limit));
    res.json(data);
  }),
);

/** Negocios "Destacado" de esta categoría × provincia — solo bajo el ranking v2. */
r.get(
  '/featured',
  ah(async (req, res) => {
    if (!isNewModelEnabled()) return res.json([]);
    const category = strParam(req.query.category);
    const province = strParam(req.query.province);
    const data = await getFeaturedProfiles(category, province);
    res.json(data);
  }),
);

export default r;
