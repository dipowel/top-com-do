/**
 * Integración con Dodo Payments (pasarela única de pago de pujas).
 * Sin SDK: `fetch` para el checkout, `crypto` para verificar el webhook
 * (especificación Standard Webhooks).
 */
import crypto from 'node:crypto';
import { SITE_URL } from '../../shared/site';
import { toLowestDenomination } from '../../shared/bidding';
import { dopToUsd, usdToDop } from '../../shared/fx';

const TOLERANCE_SEC = 5 * 60;

/**
 * Producto base "pay what you want" en Dodo (un product_id no es secreto).
 * Se elige por entorno; el usuario puede borrar DODO_PRODUCT_ID de Vercel y
 * cada entorno usa el suyo.
 */
const LIVE_PRODUCT_ID = 'pdt_0NmWVZ4XoM8UbE03yFiY8';
const TEST_PRODUCT_ID = 'pdt_0NmSUGwTYDHQKdpmPVTI';

function isLive(): boolean {
  return (process.env.DODO_ENV || 'test').toLowerCase() === 'live';
}

/** Listo para todo el ciclo (checkout + webhook). */
export function dodoConfigured(): boolean {
  return Boolean(process.env.DODO_API_KEY?.trim() && process.env.DODO_WEBHOOK_SECRET?.trim());
}

/** El checkout solo necesita la API key; el webhook valida su secreto por su cuenta. */
export function dodoCheckoutReady(): boolean {
  return Boolean(process.env.DODO_API_KEY?.trim());
}

export function dodoBaseUrl(): string {
  return isLive() ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';
}

export function dodoProductId(): string {
  return process.env.DODO_PRODUCT_ID?.trim() || (isLive() ? LIVE_PRODUCT_ID : TEST_PRODUCT_ID);
}

/**
 * Moneda del producto en Dodo. El producto live está en USD; si algún día se
 * crea uno en DOP, poner DODO_PRODUCT_CURRENCY=DOP y se cobra 1:1.
 */
export function dodoProductCurrency(): 'USD' | 'DOP' {
  return (process.env.DODO_PRODUCT_CURRENCY || 'USD').toUpperCase() === 'DOP' ? 'DOP' : 'USD';
}

/** RD$ → mínima denominación en la moneda del producto (centavos USD o DOP). */
export function amountForProduct(amountDop: number): number {
  return dodoProductCurrency() === 'DOP'
    ? toLowestDenomination(amountDop)
    : toLowestDenomination(dopToUsd(amountDop));
}

/** Centavos que devuelve Dodo (moneda del producto) → RD$. */
export function dodoAmountToDop(centavos: number): number {
  const major = centavos / 100;
  return dodoProductCurrency() === 'DOP' ? Math.round(major * 100) / 100 : usdToDop(major);
}

interface CreateCheckoutInput {
  amountDop: number;
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
    product_cart: [
      { product_id: dodoProductId(), quantity: 1, amount: amountForProduct(input.amountDop) },
    ],
    billing_currency: 'DOP', // el cliente ve RD$ (moneda adaptativa); el cargo va en la moneda del producto
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* respuesta no-JSON */
  }
  if (!res.ok) {
    const msg: string =
      data.message || data.error || data.detail || data.code || text.slice(0, 300) || 'error';
    throw new Error(
      `Dodo ${res.status} (product ${dodoProductId()}, ${dodoProductCurrency()}): ${msg}`,
    );
  }
  const checkoutUrl: string | undefined = data.checkout_url || data.payment_link || data.url;
  if (!checkoutUrl) throw new Error('Dodo no devolvió checkout_url');
  return {
    sessionId: data.session_id || data.checkout_session_id || '',
    checkoutUrl,
    raw: data,
  };
}

/** GET autenticado a la API de Dodo. Lectura pura, nunca lanza: devuelve el estado. */
export async function dodoGet(
  path: string,
): Promise<{ status: number | null; ok: boolean; body: unknown }> {
  const apiKey = process.env.DODO_API_KEY?.trim();
  if (!apiKey) return { status: null, ok: false, body: 'Falta DODO_API_KEY' };
  try {
    const res = await fetch(`${dodoBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* deja el texto crudo */
    }
    return { status: res.status, ok: res.ok, body };
  } catch (e) {
    return { status: null, ok: false, body: (e as Error).message };
  }
}

/**
 * Sonda de diagnóstico del producto base en Dodo.
 *  - 401/403 → API key inválida o de otro entorno (test vs live)
 *  - 404     → el product_id no existe (typo / entorno equivocado)
 *  - 200     → el body muestra moneda y tipo de precio (debe ser DOP y pay-what-you-want)
 */
export async function probeProduct(): Promise<{
  productId: string;
  base: string;
  status: number | null;
  ok: boolean;
  body: unknown;
}> {
  const productId = dodoProductId();
  const res = await dodoGet(`/products/${productId}`);
  return { productId, base: dodoBaseUrl(), ...res };
}

/** Pagos recientes de la cuenta (para diagnóstico y reconciliación). */
export async function listRecentPayments(limit = 20): Promise<unknown> {
  const res = await dodoGet(`/payments?page_size=${limit}`);
  return res.ok ? res.body : { error: res.status, detail: res.body };
}

/** Recupera una sesión de checkout por id. */
export async function retrieveCheckoutSession(id: string): Promise<unknown> {
  const res = await dodoGet(`/checkouts/${id}`);
  return res.ok ? res.body : { error: res.status, detail: res.body };
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
