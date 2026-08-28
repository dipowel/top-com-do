import { Router } from 'express';
import { ah } from '../lib/asyncHandler';
import { resetRound } from '../lib/rounds';
import { getRankings } from '../lib/rankings';
import { audit } from '../lib/audit';
import { HttpError } from '../middleware/errorHandler';

const r = Router();

/**
 * Reinicio semanal de ronda. Lo invoca Vercel Cron (lunes 05:00 UTC).
 * Vercel envía  Authorization: Bearer <CRON_SECRET>  automáticamente.
 */
r.get(
  '/reset-round',
  ah(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      throw new HttpError(401, 'No autorizado');
    }
    const previous = await getRankings('todo-rd', undefined, 1);
    const round = await resetRound(null);
    await audit(null, 'round.reset.cron', 'round', round.id, {
      previousChampion: previous[0]?.profile.handle ?? null,
    });
    res.json({ ok: true, round });
  }),
);

export default r;
