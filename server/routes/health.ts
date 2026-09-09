import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { ah } from '../lib/asyncHandler';
import { verifyIdToken, firebaseProjectId } from '../lib/firebaseAuth';
import { probeProduct, listRecentPayments } from '../lib/dodo';
import { importEnabled } from '../adapters/registry';

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
      jobsImport: {
        enabled: importEnabled(),
        cronPath: '/api/cron/jobs-maintenance',
        schedule: '0 6 * * *',
        joobleKeySet: Boolean(process.env.JOOBLE_API_KEY?.trim()),
        cronSecretSet: Boolean(process.env.CRON_SECRET?.trim()),
      },
      paymentProvider: (process.env.PAYMENT_PROVIDER || 'azul').toLowerCase(),
      azul: {
        configured: Boolean(process.env.AZUL_MERCHANT_ID?.trim() && process.env.AZUL_AUTH_KEY?.trim()),
        env: process.env.AZUL_ENV || 'test',
        merchantId: process.env.AZUL_MERCHANT_ID || '(vacío)',
        merchantName: process.env.AZUL_MERCHANT_NAME || 'Top.com.do (default)',
        currencyCode: process.env.AZUL_CURRENCY_CODE || '$ (default)',
        authKeyHint: mask(process.env.AZUL_AUTH_KEY),
        itbisRate: process.env.AZUL_ITBIS_RATE || '0',
        envVarsSeen: Object.keys(process.env)
          .filter((k) => k.startsWith('AZUL'))
          .sort(),
      },
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

    // Sonda en vivo del producto de Dodo: /api/health/config?dodoProbe=<CRON_SECRET>
    const probeKey = typeof req.query.dodoProbe === 'string' ? req.query.dodoProbe : '';
    if (probeKey && process.env.CRON_SECRET && probeKey === process.env.CRON_SECRET) {
      out.dodoProbe = await probeProduct();
      out.dodoRecentPayments = await listRecentPayments(5);
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
