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
r.get(
  '/health/config',
  ah(async (req, res) => {
    const out: Record<string, unknown> = {
      env: process.env.NODE_ENV || 'unknown',
      databaseUrlSet: Boolean(process.env.DATABASE_URL),
      firebaseProjectId: firebaseProjectId(),
      superadminEmailsSet: Boolean(process.env.SUPERADMIN_EMAILS),
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET),
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
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
