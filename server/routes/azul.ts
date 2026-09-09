/**
 * Retornos del navegador desde la Página de Pago de AZUL. NO llevan sesión: la
 * seguridad es la verificación del `AuthHash` de respuesta. AZUL manda los datos en
 * el querystring (a veces con `&` en lugar de `?` — se normaliza).
 */
import { Router, urlencoded, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { azulPayments, bids } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { audit } from '../lib/audit';
import { verifyAzulResponse, parseAzulReturn } from '../lib/azul';
import { fulfillAzulBid } from '../lib/azulFulfill';
import { SITE_URL } from '../../shared/site';

const r = Router();

/**
 * La doc de AZUL muestra retornos con `&` en vez del primer `?`
 * (`.../approved&OrderNumber=...`). Express no enruta eso. Se reescribe `req.url`
 * ANTES del enrutado: primer `&` (sin `?` previo) → `?`.
 */
r.use((req, _res, next) => {
  const q = req.url.indexOf('?');
  const amp = req.url.indexOf('&');
  if (amp >= 0 && (q < 0 || amp < q)) {
    req.url = req.url.slice(0, amp) + '?' + req.url.slice(amp + 1);
  }
  next();
});

r.use(urlencoded({ extended: false }));

function collectParams(req: Request): Record<string, string> {
  const fromUrl = parseAzulReturn(req.originalUrl);
  const fromQuery = req.query as Record<string, string>;
  const fromBody = (req.body ?? {}) as Record<string, string>;
  return { ...fromUrl, ...fromQuery, ...fromBody };
}

async function findRow(params: Record<string, string>) {
  const order = params.OrderNumber || params.o || '';
  if (!order) return null;
  const [row] = await db.select().from(azulPayments).where(eq(azulPayments.orderNumber, order)).limit(1);
  return row ?? null;
}

async function profileIdOfBid(bidId: string): Promise<string | null> {
  const [b] = await db.select({ profileId: bids.profileId }).from(bids).where(eq(bids.id, bidId)).limit(1);
  return b?.profileId ?? null;
}

const redirect = (res: import('express').Response, path: string) => res.redirect(302, `${SITE_URL}${path}`);

/** Resultado aprobado o declinado (AZUL manda parámetros + AuthHash). */
async function handleResult(req: Request, res: import('express').Response, kind: 'approved' | 'declined') {
  const params = collectParams(req);
  const row = await findRow(params);
  if (!row) {
    return redirect(res, '/mis-pujas?pago=verificando');
  }
  if (row.status === 'approved') {
    return redirect(res, `/recibo/${row.bidId}?pago=ok`);
  }

  const ok = verifyAzulResponse(params);
  if (!ok) {
    await db.update(azulPayments).set({ status: 'error', raw: params, updatedAt: new Date() }).where(eq(azulPayments.id, row.id));
    await audit(null, 'bid.azul.hash_mismatch', 'bid', row.bidId, { order: row.orderNumber, kind });
    return redirect(res, `/recibo/${row.bidId}?pago=verificando`);
  }

  const outcome = await fulfillAzulBid(row, params);
  if (outcome === 'verified' || outcome === 'already') {
    return redirect(res, `/recibo/${row.bidId}?pago=ok`);
  }
  // declined / not_found
  const profileId = await profileIdOfBid(row.bidId);
  return redirect(res, profileId ? `/p/${profileId}?pago=declinado` : '/mis-pujas?pago=declinado');
}

r.get('/approved', ah((req, res) => handleResult(req, res, 'approved')));
r.post('/approved', ah((req, res) => handleResult(req, res, 'approved')));
r.get('/declined', ah((req, res) => handleResult(req, res, 'declined')));
r.post('/declined', ah((req, res) => handleResult(req, res, 'declined')));

/** El cliente canceló en la Página de Pago (AZUL no manda parámetros). */
async function handleCancel(req: Request, res: import('express').Response) {
  const params = collectParams(req);
  const row = await findRow(params);
  if (!row) return redirect(res, '/mis-pujas?pago=cancelado');
  if (row.status !== 'approved') {
    const profileId = await profileIdOfBid(row.bidId);
    await db
      .update(azulPayments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(azulPayments.id, row.id));
    await db.delete(bids).where(eq(bids.id, row.bidId));
    await audit(null, 'bid.azul.cancelled', 'bid', row.bidId, { order: row.orderNumber });
    return redirect(res, profileId ? `/p/${profileId}?pago=cancelado` : '/mis-pujas?pago=cancelado');
  }
  return redirect(res, `/recibo/${row.bidId}?pago=ok`);
}

r.get('/cancel', ah(handleCancel));
r.post('/cancel', ah(handleCancel));

export default r;
