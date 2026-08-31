import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyWebhook,
  dodoBaseUrl,
  dodoProductId,
  dodoCheckoutReady,
  amountForProduct,
  dodoAmountToDop,
} from './dodo';

function sign(rawSecretB64: string, id: string, ts: string, payload: string): string {
  return crypto
    .createHmac('sha256', Buffer.from(rawSecretB64, 'base64'))
    .update(`${id}.${ts}.${payload}`)
    .digest('base64');
}

describe('dodo · verifyWebhook (Standard Webhooks)', () => {
  const rawSecret = crypto.randomBytes(24).toString('base64');

  beforeEach(() => {
    process.env.DODO_WEBHOOK_SECRET = `whsec_${rawSecret}`;
  });

  it('acepta una firma válida y devuelve el evento', () => {
    const id = 'evt_1';
    const ts = String(Math.floor(Date.now() / 1000));
    const payload = JSON.stringify({ type: 'payment.succeeded', data: { payment_id: 'pay_1' } });
    const event = verifyWebhook(Buffer.from(payload), {
      id,
      timestamp: ts,
      signature: `v1,${sign(rawSecret, id, ts, payload)}`,
    }) as { type: string };
    expect(event.type).toBe('payment.succeeded');
  });

  it('rechaza una firma inválida', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(() =>
      verifyWebhook(Buffer.from('{}'), { id: 'x', timestamp: ts, signature: 'v1,deadbeef' }),
    ).toThrow();
  });

  it('rechaza un timestamp fuera de tolerancia', () => {
    const id = 'evt_2';
    const ts = String(Math.floor(Date.now() / 1000) - 999);
    const payload = '{}';
    expect(() =>
      verifyWebhook(Buffer.from(payload), {
        id,
        timestamp: ts,
        signature: `v1,${sign(rawSecret, id, ts, payload)}`,
      }),
    ).toThrow();
  });

  it('rechaza si faltan cabeceras', () => {
    expect(() => verifyWebhook(Buffer.from('{}'), {})).toThrow();
  });
});

describe('dodo · configuración', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env = { ...prev };
  });

  it('dodoBaseUrl cambia con DODO_ENV', () => {
    process.env.DODO_ENV = 'live';
    expect(dodoBaseUrl()).toBe('https://live.dodopayments.com');
    process.env.DODO_ENV = 'test';
    expect(dodoBaseUrl()).toBe('https://test.dodopayments.com');
  });

  it('dodoProductId usa el producto por entorno o el override por env', () => {
    delete process.env.DODO_PRODUCT_ID;
    process.env.DODO_ENV = 'test';
    expect(dodoProductId()).toBe('pdt_0NmSUGwTYDHQKdpmPVTI');
    process.env.DODO_ENV = 'live';
    expect(dodoProductId()).toBe('pdt_0NmWVZ4XoM8UbE03yFiY8');
    process.env.DODO_PRODUCT_ID = 'pdt_custom';
    expect(dodoProductId()).toBe('pdt_custom');
  });

  it('convierte RD$ ↔ moneda del producto', () => {
    process.env.DODO_PRODUCT_CURRENCY = 'DOP';
    expect(amountForProduct(200)).toBe(20000); // RD$200 → 20000 centavos DOP
    expect(dodoAmountToDop(20000)).toBe(200);

    process.env.DODO_PRODUCT_CURRENCY = 'USD';
    expect(amountForProduct(59.5)).toBe(100); // RD$59.50 → USD 1.00 → 100 centavos
    expect(dodoAmountToDop(100)).toBe(59.5); // USD 1.00 → RD$59.50
  });

  it('dodoCheckoutReady solo exige DODO_API_KEY (no vacía)', () => {
    delete process.env.DODO_API_KEY;
    expect(dodoCheckoutReady()).toBe(false);
    process.env.DODO_API_KEY = '   ';
    expect(dodoCheckoutReady()).toBe(false);
    process.env.DODO_API_KEY = 'k_live_abc';
    expect(dodoCheckoutReady()).toBe(true);
  });
});
