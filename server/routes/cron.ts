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

/** Marca como expiradas las vacantes vencidas + avisa a Google. Vercel Cron (diario). */
r.get(
  '/expire-jobs',
  ah(async (req, res) => {
    assertCron(req);
    const { expired } = await expireStaleJobs();
    await audit(null, 'jobs.expire.cron', 'job', null, { count: expired.length });
    res.json({ ok: true, expired: expired.length, slugs: expired });
  }),
);

/** Importa vacantes de las fuentes habilitadas (ATS/CSV/Jooble). Manual / trigger. */
r.get(
  '/import-jobs',
  ah(async (req, res) => {
    assertCron(req);
    const { runDueSources } = await import('../lib/jobImport');
    const runs = await runDueSources();
    await audit(null, 'jobs.import.cron', 'job', null, { runs: runs.length });
    res.json({ ok: true, runs });
  }),
);

/** Reintenta las notificaciones pendientes a la Google Indexing API. Manual / trigger. */
r.get(
  '/indexing-retry',
  ah(async (req, res) => {
    assertCron(req);
    const { flushJobIndexing } = await import('../lib/googleIndexing');
    const out = await flushJobIndexing();
    res.json({ ok: true, ...out });
  }),
);

/**
 * Mantenimiento de empleos en un solo tick. Vercel Cron 1×/día (Hobby permite un
 * cron diario). Si se pasa a Vercel Pro se puede subir a `0 * / 6 * * *`.
 * 1) expira vencidas + avisa a Google, 2) importa de fuentes habilitadas,
 * 3) reintenta notificaciones de Indexing pendientes. Todo acotado en tiempo.
 * Respaldo entre corridas: `maybeExpireJobs()` (perezoso, 1×/hora) en GET /api/jobs.
 */
r.get(
  '/jobs-maintenance',
  ah(async (req, res) => {
    assertCron(req);
    const [{ expireStaleJobs }, { runDueSources }, { flushJobIndexing }] = await Promise.all([
      import('../lib/jobs'),
      import('../lib/jobImport'),
      import('../lib/googleIndexing'),
    ]);
    const expired = await expireStaleJobs().catch((e) => ({ expired: [], error: String(e) }));
    const runs = await runDueSources().catch(() => []);
    const indexing = await flushJobIndexing().catch(() => ({ sent: 0, failed: 0 }));
    await audit(null, 'jobs.maintenance.cron', 'job', null, {
      expired: (expired as { expired: string[] }).expired.length,
      runs: runs.length,
      indexingSent: indexing.sent,
    });
    res.json({ ok: true, expired, runs, indexing });
  }),
);

export default r;
