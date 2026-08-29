import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { ah } from '../lib/asyncHandler';
import { verifyIdToken, firebaseProjectId } from '../lib/firebaseAuth';

const r = Router();

r.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'top.com.do', time: new Date().toISOString() });
});

/**
 * Diagnóstico de configuración (sin exponer secretos).
 * Abre /api/health/config, o manda Authorization: Bearer <idToken>
 * para probar la verificación del token.
 */
/** Pista segura de un secreto: nunca lo expone entero, solo longitud + 3 últimos chars. */
function mask(v: string | undefined): string {
  const t = (v ?? '').trim();
  if (!t) return '(vacío)';
  return `len=${t.length} …${t.slice(-3)}`;
}

r.get(
  '/health/config',
  ah(async (req, res) => {
    const out: Record<string, unknown> = {
      env: process.env.NODE_ENV || 'unknown',
      databaseUrlSet: Boolean(process.env.DATABASE_URL),
      firebaseProjectId: firebaseProjectId(),
      superadminEmailsSet: Boolean(process.env.SUPERADMIN_EMAILS),
      dodoConfigured: Boolean(process.env.DODO_API_KEY && process.env.DODO_WEBHOOK_SECRET),
      dodoEnv: process.env.DODO_ENV || 'test',
      dodo: {
        apiKeySet: Boolean(process.env.DODO_API_KEY?.trim()),
        webhookSecretSet: Boolean(process.env.DODO_WEBHOOK_SECRET?.trim()),
        productId: process.env.DODO_PRODUCT_ID || 'pdt_0NmSUGwTYDHQKdpmPVTI (default)',
        env: process.env.DODO_ENV || 'test',
        apiKeyHint: mask(process.env.DODO_API_KEY),
        webhookSecretHint: mask(process.env.DODO_WEBHOOK_SECRET),
        // revela typos en el NOMBRE de la variable (p. ej. "DODO_APIKEY")
        envVarsSeen: Object.keys(process.env)
          .filter((k) => k.startsWith('DODO'))
          .sort(),
      },
    };

    try {
      await db.execute(sql`select 1`);
      out.database = 'ok';
    } catch (e) {
      out.database = `error: ${(e as Error).message}`;
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (token) {
      try {
        const decoded = await verifyIdToken(token);
        out.tokenCheck = { ok: true, email: decoded.email, uid: decoded.uid, aud: decoded.aud };
      } catch (e) {
        out.tokenCheck = { ok: false, error: (e as Error).message };
      }
    }

    res.json(out);
  }),
);

export default r;
