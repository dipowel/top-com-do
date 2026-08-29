/**
 * Integración con Dodo Payments (pasarela única de pago de pujas).
 * Sin SDK: `fetch` para el checkout, `crypto` para verificar el webhook
 * (especificación Standard Webhooks).
 */
import crypto from 'node:crypto';
import { SITE_URL } from '../../shared/site';
import type { BidTier } from '../../shared/bidding';

const TOLERANCE_SEC = 5 * 60;

export function dodoConfigured(): boolean {
  return Boolean(process.env.DODO_API_KEY && process.env.DODO_WEBHOOK_SECRET);
}

export function dodoBaseUrl(): string {
  return (process.env.DODO_ENV || 'test').toLowerCase() === 'live'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';
}

export function productIdForTier(tier: BidTier): string {
  const id = process.env[`DODO_PRODUCT_${tier}`];
  if (!id) throw new Error(`Falta la variable de entorno DODO_PRODUCT_${tier}`);
  return id;
}

interface CreateCheckoutInput {
  tier: BidTier;
  bidId: string;
  profileId: string;
  roundId: string;
  customerEmail: string;
}

export async function createCheckout(
  input: CreateCheckoutInput,
): Promise<{ sessionId: string; checkoutUrl: string; raw: unknown }> {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) throw new Error('Falta DODO_API_KEY');

  const body = {
    product_cart: [{ product_id: productIdForTier(input.tier), quantity: 1 }],
    billing_currency: 'DOP',
    customer: { email: input.customerEmail },
    metadata: {
      bid_id: input.bidId,
      profile_id: input.profileId,
      round_id: input.roundId,
    },
    return_url: `${SITE_URL}/mis-pujas?pago=procesando`,
  };

  const res = await fetch(`${dodoBaseUrl()}/checkouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Dodo checkout ${res.status}: ${data?.message || text || 'error'}`);
  }
  const checkoutUrl: string | undefined = data.checkout_url || data.payment_link || data.url;
  if (!checkoutUrl) throw new Error('Dodo no devolvió checkout_url');
  return {
    sessionId: data.session_id || data.checkout_session_id || '',
    checkoutUrl,
    raw: data,
  };
}

// ---------------- Webhook (Standard Webhooks) ----------------

interface WebhookHeaders {
  id?: string | string[];
  timestamp?: string | string[];
  signature?: string | string[];
}

function firstHeader(v?: string | string[]): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

/**
 * Verifica la firma del webhook y devuelve el evento parseado.
 * Lanza si la firma / timestamp no son válidos.
 */
export function verifyWebhook(rawBody: Buffer | string, headers: WebhookHeaders): unknown {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) throw new Error('Falta DODO_WEBHOOK_SECRET');

  const id = firstHeader(headers.id);
  const ts = firstHeader(headers.timestamp);
  const sigHeader = firstHeader(headers.signature);
  if (!id || !ts || !sigHeader) throw new Error('Faltan cabeceras del webhook');

  const now = Math.floor(Date.now() / 1000);
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > TOLERANCE_SEC) {
    throw new Error('Timestamp del webhook fuera de tolerancia');
  }

  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${ts}.${payload}`)
    .digest('base64');

  // "webhook-signature: v1,<sig> v1,<sig2> ..."
  const provided = sigHeader
    .split(' ')
    .map((p) => (p.includes(',') ? p.split(',')[1] : p))
    .filter(Boolean);

  const ok = provided.some((p) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(p), Buffer.from(expected));
    } catch {
      return false;
    }
  });
  if (!ok) throw new Error('Firma del webhook inválida');

  return JSON.parse(payload);
}
