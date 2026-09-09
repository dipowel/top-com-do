/**
 * Integración con la Página de Pago de AZUL (Servicios Digitales Popular).
 *
 * El navegador del cliente hace un POST con campos "hidden" a la URL de AZUL; al
 * terminar, AZUL devuelve al cliente a nuestras ApprovedUrl/DeclinedUrl con los
 * datos de la transacción en el querystring y un `AuthHash` que hay que verificar.
 *
 * Autenticación (doc "Manejo de la Autenticación"): `AuthHash` = HMAC-SHA512 sobre
 * la concatenación EXACTA de campos + `AuthKey`, en UNICODE (UTF-16LE), hex minúsculas.
 * La `AuthKey` NO viaja en el POST. Nunca se loguea ni se guardan datos de tarjeta.
 */
import crypto from 'node:crypto';
import { SITE_URL } from '../../shared/site';
import { toLowestDenomination } from '../../shared/bidding';

export interface AzulConfig {
  merchantId: string;
  authKey: string;
  merchantName: string;
  merchantType: string;
  currencyCode: string;
  altMerchantName: string;
  locale: string;
  env: 'test' | 'prod';
  paymentUrl: string;
  paymentUrlAlt: string;
  itbisRate: number;
  googlePay: boolean;
  applePay: boolean;
}

const PROD_URL = 'https://pagos.azul.com.do/PaymentPage/Default.aspx';
const PROD_URL_ALT = 'https://contpagos.azul.com.do/PaymentPage/Default.aspx';
const TEST_URL = 'https://pruebas.azul.com.do/PaymentPage/';

export function azulConfig(): AzulConfig {
  const env = (process.env.AZUL_ENV || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';
  const rate = Number(process.env.AZUL_ITBIS_RATE || '0');
  return {
    merchantId: (process.env.AZUL_MERCHANT_ID || '').trim(),
    authKey: process.env.AZUL_AUTH_KEY || '',
    merchantName: (process.env.AZUL_MERCHANT_NAME || 'Top.com.do').trim(),
    merchantType: (process.env.AZUL_MERCHANT_TYPE || 'ECommerce').trim(),
    currencyCode: (process.env.AZUL_CURRENCY_CODE || '$').trim(),
    altMerchantName: (process.env.AZUL_ALT_MERCHANT_NAME || 'Top.com.do').trim().slice(0, 25),
    locale: (process.env.AZUL_LOCALE || 'ES').trim().toUpperCase(),
    env,
    paymentUrl: (process.env.AZUL_PAYMENT_URL || (env === 'prod' ? PROD_URL : TEST_URL)).trim(),
    paymentUrlAlt: (process.env.AZUL_PAYMENT_URL_ALT || (env === 'prod' ? PROD_URL_ALT : TEST_URL)).trim(),
    // 0 (o sin definir) → comercio exento: el formulario envía ITBIS "000".
    itbisRate: Number.isFinite(rate) && rate > 0 && rate < 1 ? rate : 0,
    googlePay: String(process.env.AZUL_GOOGLE_PAY || '').toLowerCase() === 'true',
    applePay: String(process.env.AZUL_APPLE_PAY || '').toLowerCase() === 'true',
  };
}

export const azulConfigured = (): boolean => {
  const c = azulConfig();
  return Boolean(c.merchantId && c.authKey);
};

/** RD$ → string de centavos sin separadores (los 2 últimos dígitos son decimales). */
export function formatAzulAmount(dop: number): string {
  return String(Math.max(0, toLowestDenomination(dop)));
}

/**
 * ITBIS en el formato de AZUL: mismo formato que `Amount` (centavos sin separadores).
 * Para comercios/transacciones EXENTOS la doc exige el literal `"000"` (= 0.00), no `"0"`.
 */
export function formatAzulItbis(dop: number): string {
  return dop > 0 ? formatAzulAmount(dop) : '000';
}

/** Quita caracteres que AZUL rechaza o recorta en labels/valores visibles. */
export function azulSafeText(s: string, max = 120): string {
  return s
    .replace(/["'\\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** HMAC-SHA512 sobre (mensaje + authKey) en UTF-16LE, con authKey también como clave. Hex minúsculas. */
function azulHmac(message: string, authKey: string): string {
  const bytes = Buffer.from(message + authKey, 'utf16le');
  return crypto.createHmac('sha512', authKey).update(bytes).digest('hex');
}

/** Campos que entran en el hash del requerimiento de venta, EN ORDEN (doc pág. 8). */
export interface AzulSaleHashFields {
  MerchantId: string;
  MerchantName: string;
  MerchantType: string;
  CurrencyCode: string;
  OrderNumber: string;
  Amount: string;
  ITBIS: string;
  ApprovedUrl: string;
  DeclinedUrl: string;
  CancelUrl: string;
  UseCustomField1: string;
  CustomField1Label: string;
  CustomField1Value: string;
  UseCustomField2: string;
  CustomField2Label: string;
  CustomField2Value: string;
}

export function azulRequestHash(f: AzulSaleHashFields, authKey = azulConfig().authKey): string {
  const msg =
    f.MerchantId +
    f.MerchantName +
    f.MerchantType +
    f.CurrencyCode +
    f.OrderNumber +
    f.Amount +
    f.ITBIS +
    f.ApprovedUrl +
    f.DeclinedUrl +
    f.CancelUrl +
    f.UseCustomField1 +
    f.CustomField1Label +
    f.CustomField1Value +
    f.UseCustomField2 +
    f.CustomField2Label +
    f.CustomField2Value;
  return azulHmac(msg, authKey);
}

const g = (p: Record<string, unknown>, k: string): string => {
  const v = p[k];
  return v == null ? '' : String(v);
};

/** Hash de la respuesta (doc pág. 8): SIN ITBIS. Acepta IsoCode / ISOCode. */
export function azulResponseHash(params: Record<string, unknown>, authKey = azulConfig().authKey): string {
  const iso = params.IsoCode ?? params.ISOCode ?? '';
  const msg =
    g(params, 'OrderNumber') +
    g(params, 'Amount') +
    g(params, 'AuthorizationCode') +
    g(params, 'DateTime') +
    g(params, 'ResponseCode') +
    String(iso) +
    g(params, 'ResponseMessage') +
    g(params, 'ErrorDescription') +
    g(params, 'RRN');
  return azulHmac(msg, authKey);
}

/** Compara (case-insensitive, timing-safe) el AuthHash recibido con el recalculado. */
export function verifyAzulResponse(params: Record<string, unknown>, authKey = azulConfig().authKey): boolean {
  const received = String(params.AuthHash ?? '').toLowerCase();
  if (received.length !== 128) return false;
  const expected = azulResponseHash(params, authKey).toLowerCase();
  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export const azulIsApproved = (params: Record<string, unknown>): boolean =>
  String(params.IsoCode ?? params.ISOCode ?? '').trim() === '00';

export interface AzulSaleForm {
  actionUrl: string;
  actionUrlAlt: string;
  fields: Record<string, string>;
}

/** Construye el formulario de venta (campos hidden) + su AuthHash. */
export function buildAzulSaleForm(input: {
  orderNumber: string;
  amountDop: number;
  concept: string;
}): AzulSaleForm {
  const c = azulConfig();
  const Amount = formatAzulAmount(input.amountDop);
  // Exento (rate 0 / sin definir) → "000". Con tasa → el ITBIS incluido en el total.
  const ITBIS =
    c.itbisRate > 0
      ? formatAzulItbis(round2(input.amountDop - input.amountDop / (1 + c.itbisRate)))
      : '000';
  const base = `${SITE_URL}/api/pay/azul`;
  const o = encodeURIComponent(input.orderNumber);

  const hashFields: AzulSaleHashFields = {
    MerchantId: c.merchantId,
    MerchantName: c.merchantName,
    MerchantType: c.merchantType,
    CurrencyCode: c.currencyCode,
    OrderNumber: input.orderNumber,
    Amount,
    ITBIS,
    ApprovedUrl: `${base}/approved?o=${o}`,
    DeclinedUrl: `${base}/declined?o=${o}`,
    CancelUrl: `${base}/cancel?o=${o}`,
    UseCustomField1: '1',
    CustomField1Label: 'Concepto',
    CustomField1Value: azulSafeText(input.concept, 120),
    UseCustomField2: '0',
    CustomField2Label: '',
    CustomField2Value: '',
  };

  const fields: Record<string, string> = {
    ...hashFields,
    AuthHash: azulRequestHash(hashFields, c.authKey),
    // No entran en el hash:
    ShowTransactionResult: '1',
    Locale: c.locale,
    AltMerchantName: c.altMerchantName,
    LogoImageUrl: `${SITE_URL}/logo.png`,
  };
  if (c.googlePay) fields.UseGooglePay = '1';
  if (c.applePay) fields.UseApplePay = '1';

  return { actionUrl: c.paymentUrl, actionUrlAlt: c.paymentUrlAlt, fields };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Número de orden numérico único-ish: yyyyMMddHHmmss + 2 dígitos aleatorios. */
export function newAzulOrderNumber(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}` +
    p(Math.floor(Math.random() * 100))
  );
}

/**
 * Normaliza el querystring de retorno de AZUL: la doc muestra casos con `&` en
 * lugar del primer `?`, o con un segundo `?`. Devuelve los pares clave/valor.
 */
export function parseAzulReturn(originalUrl: string): Record<string, string> {
  let qs = '';
  const qMark = originalUrl.indexOf('?');
  const amp = originalUrl.indexOf('&');
  if (qMark >= 0) {
    qs = originalUrl.slice(qMark + 1).replace(/\?/g, '&'); // 2º '?' → '&'
  } else if (amp >= 0) {
    qs = originalUrl.slice(amp + 1); // AZUL usó '&' como separador inicial
  }
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(qs)) out[k] = v;
  return out;
}
