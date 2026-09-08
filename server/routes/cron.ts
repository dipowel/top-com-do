import { Router } from 'express';
import { ah } from '../lib/asyncHandler';
import { resetRound } from '../lib/rounds';
import { getRankings } from '../lib/rankings';
import { expireStaleJobs } from '../lib/jobs';
import { audit } from '../lib/audit';
import { HttpError } from '../middleware/errorHandler';

const r = Router();

function assertCron(req: { headers: Record<string, unknown> }): void {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    throw new HttpError(401, 'No autorizado');
  }
}

/**
 * Reinicio semanal de ronda. Lo invoca Vercel Cron (lunes 05:00 UTC).
 * Vercel envía  Authorization: Bearer <CRON_SECRET>  automáticamente.
 */
r.get(
  '/reset-round',
  ah(async (req, res) => {
    assertCron(req);
    const previous = await getRankings('todo-rd', undefined, 1);
    const round = await resetRound(null);
    await audit(null, 'round.reset.cron', 'round', round.id, {
      previousChampion: previous[0]?.profile.handle ?? null,
    });
    res.json({ ok: true, round });
  }),
);

/** Marca como expiradas las vacantes vencidas. Vercel Cron (diario). */
r.get(
  '/expire-jobs',
  ah(async (req, res) => {
    assertCron(req);
    const expired = await expireStaleJobs();
    await audit(null, 'jobs.expire.cron', 'job', null, { expired });
    res.json({ ok: true, expired });
  }),
);

export default r;
