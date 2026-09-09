import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import {
  formatAzulAmount,
  formatAzulItbis,
  azulRequestHash,
  azulResponseHash,
  verifyAzulResponse,
  azulIsApproved,
  parseAzulReturn,
  newAzulOrderNumber,
  azulSafeText,
  buildAzulSaleForm,
  type AzulSaleHashFields,
} from './lib/azul';

const KEY = 'test-auth-key-1234567890';

/** Referencia independiente del algoritmo documentado por AZUL (UTF-16LE, key anexada + como clave). */
function refHmac(message: string): string {
  const bytes = Buffer.from(message + KEY, 'utf16le');
  return crypto.createHmac('sha512', KEY).update(bytes).digest('hex');
}

const saleFields: AzulSaleHashFields = {
  MerchantId: '39038540035',
  MerchantName: 'Top.com.do',
  MerchantType: 'ECommerce',
  CurrencyCode: '$',
  OrderNumber: '2026090714322099',
  Amount: '60000',
  ITBIS: '0',
  ApprovedUrl: 'https://www.top.com.do/api/pay/azul/approved?o=2026090714322099',
  DeclinedUrl: 'https://www.top.com.do/api/pay/azul/declined?o=2026090714322099',
  CancelUrl: 'https://www.top.com.do/api/pay/azul/cancel?o=2026090714322099',
  UseCustomField1: '1',
  CustomField1Label: 'Concepto',
  CustomField1Value: 'Puja #1 - Punto Parrillada 2',
  UseCustomField2: '0',
  CustomField2Label: '',
  CustomField2Value: '',
};

describe('azul · formatAzulAmount', () => {
  it('convierte RD$ a centavos sin separadores', () => {
    expect(formatAzulAmount(500)).toBe('50000');
    expect(formatAzulAmount(100)).toBe('10000');
    expect(formatAzulAmount(1234.5)).toBe('123450');
    expect(formatAzulAmount(0)).toBe('0');
    expect(formatAzulAmount(17483.21)).toBe('1748321');
  });
});

describe('azul · hash del requerimiento', () => {
  it('concatena los 16 campos EN ORDEN + AuthKey (doc pág. 8)', () => {
    const expected = refHmac(
      saleFields.MerchantId +
        saleFields.MerchantName +
        saleFields.MerchantType +
        saleFields.CurrencyCode +
        saleFields.OrderNumber +
        saleFields.Amount +
        saleFields.ITBIS +
        saleFields.ApprovedUrl +
        saleFields.DeclinedUrl +
        saleFields.CancelUrl +
        saleFields.UseCustomField1 +
        saleFields.CustomField1Label +
        saleFields.CustomField1Value +
        saleFields.UseCustomField2 +
        saleFields.CustomField2Label +
        saleFields.CustomField2Value,
    );
    expect(azulRequestHash(saleFields, KEY)).toBe(expected);
    expect(azulRequestHash(saleFields, KEY)).toMatch(/^[0-9a-f]{128}$/);
  });

  it('cambia si cambia cualquier campo', () => {
    const a = azulRequestHash(saleFields, KEY);
    const b = azulRequestHash({ ...saleFields, Amount: '60001' }, KEY);
    expect(a).not.toBe(b);
  });
});

describe('azul · hash de respuesta', () => {
  const resp = {
    OrderNumber: '2026090714322099',
    Amount: '60000',
    ITBIS: '0',
    AuthorizationCode: 'OK1234',
    DateTime: '20260907143218',
    ResponseCode: 'ISO8583',
    IsoCode: '00',
    ResponseMessage: 'APROBADA',
    ErrorDescription: '',
    RRN: '2026090714322000441290',
  };

  it('concatena SIN ITBIS (doc pág. 8) + AuthKey', () => {
    const expected = refHmac(
      resp.OrderNumber +
        resp.Amount +
        resp.AuthorizationCode +
        resp.DateTime +
        resp.ResponseCode +
        resp.IsoCode +
        resp.ResponseMessage +
        resp.ErrorDescription +
        resp.RRN,
    );
    expect(azulResponseHash(resp, KEY)).toBe(expected);
  });

  it('el ITBIS NO afecta el hash de respuesta', () => {
    const a = azulResponseHash(resp, KEY);
    const b = azulResponseHash({ ...resp, ITBIS: '9999' }, KEY);
    expect(a).toBe(b);
  });

  it('acepta ISOCode además de IsoCode', () => {
    const a = azulResponseHash(resp, KEY);
    const { IsoCode, ...rest } = resp;
    void IsoCode;
    const b = azulResponseHash({ ...rest, ISOCode: '00' }, KEY);
    expect(a).toBe(b);
  });

  it('verifyAzulResponse: true con AuthHash correcto, false si se altera', () => {
    const good = { ...resp, AuthHash: azulResponseHash(resp, KEY) };
    expect(verifyAzulResponse(good, KEY)).toBe(true);
    expect(verifyAzulResponse({ ...good, Amount: '1' }, KEY)).toBe(false);
    expect(verifyAzulResponse({ ...resp, AuthHash: 'deadbeef' }, KEY)).toBe(false);
    expect(verifyAzulResponse(resp, KEY)).toBe(false); // sin AuthHash
  });
});

describe('azul · varios', () => {
  it('azulIsApproved solo con IsoCode 00', () => {
    expect(azulIsApproved({ IsoCode: '00' })).toBe(true);
    expect(azulIsApproved({ ISOCode: '00' })).toBe(true);
    expect(azulIsApproved({ IsoCode: '05' })).toBe(false);
    expect(azulIsApproved({})).toBe(false);
  });

  it('parseAzulReturn normaliza & y ? extra', () => {
    expect(parseAzulReturn('/x/approved?a=1&b=2')).toEqual({ a: '1', b: '2' });
    expect(parseAzulReturn('/x/approved&a=1&b=2')).toEqual({ a: '1', b: '2' });
    expect(parseAzulReturn('/x/approved?o=9?a=1&b=2')).toEqual({ o: '9', a: '1', b: '2' });
    expect(parseAzulReturn('/x/cancel')).toEqual({});
  });

  it('newAzulOrderNumber: 16 dígitos numéricos', () => {
    expect(newAzulOrderNumber()).toMatch(/^\d{16}$/);
    expect(newAzulOrderNumber()).not.toBe(newAzulOrderNumber());
  });

  it('azulSafeText quita comillas/barras, colapsa espacios y recorta', () => {
    expect(azulSafeText('Puja "#1" \\ O\'Brien')).toBe('Puja #1 OBrien');
    expect(azulSafeText('x'.repeat(200), 10).length).toBe(10);
    expect(azulSafeText('a\nb\tc')).toBe('a b c');
  });

  it('formatAzulItbis: exento / cero → "000"; con monto → cents', () => {
    expect(formatAzulItbis(0)).toBe('000');
    expect(formatAzulItbis(-1)).toBe('000');
    expect(formatAzulItbis(91.53)).toBe('9153');
    expect(formatAzulItbis(0.5)).toBe('50');
  });
});

describe('azul · buildAzulSaleForm', () => {
  const prev = { ...process.env };
  beforeAll(() => {
    process.env.AZUL_MERCHANT_ID = '39038540035';
    process.env.AZUL_AUTH_KEY = 'test-auth-key-1234567890';
    process.env.AZUL_ENV = 'test';
    delete process.env.AZUL_ITBIS_RATE;
  });
  afterAll(() => {
    process.env = prev;
  });

  const input = { orderNumber: '2026090714322099', amountDop: 600, concept: 'Puja #1 - Punto Parrillada 2' };

  it('comercio exento: ITBIS "000", Amount total, AuthHash consistente con los campos', () => {
    const { fields } = buildAzulSaleForm(input);
    expect(fields.ITBIS).toBe('000');
    expect(fields.Amount).toBe('60000');
    expect(fields.AuthHash).toMatch(/^[0-9a-f]{128}$/);

    const recomputed = azulRequestHash(
      {
        MerchantId: fields.MerchantId,
        MerchantName: fields.MerchantName,
        MerchantType: fields.MerchantType,
        CurrencyCode: fields.CurrencyCode,
        OrderNumber: fields.OrderNumber,
        Amount: fields.Amount,
        ITBIS: fields.ITBIS,
        ApprovedUrl: fields.ApprovedUrl,
        DeclinedUrl: fields.DeclinedUrl,
        CancelUrl: fields.CancelUrl,
        UseCustomField1: fields.UseCustomField1,
        CustomField1Label: fields.CustomField1Label,
        CustomField1Value: fields.CustomField1Value,
        UseCustomField2: fields.UseCustomField2,
        CustomField2Label: fields.CustomField2Label,
        CustomField2Value: fields.CustomField2Value,
      } as AzulSaleHashFields,
      'test-auth-key-1234567890',
    );
    expect(fields.AuthHash).toBe(recomputed);
  });

  it('con AZUL_ITBIS_RATE=0.18: ITBIS es cents ≠ "000" y Amount sigue siendo el total', () => {
    process.env.AZUL_ITBIS_RATE = '0.18';
    try {
      const { fields } = buildAzulSaleForm(input);
      expect(fields.Amount).toBe('60000');
      expect(fields.ITBIS).not.toBe('000');
      expect(fields.ITBIS).toMatch(/^\d+$/);
      expect(Number(fields.ITBIS)).toBeGreaterThan(0);
    } finally {
      delete process.env.AZUL_ITBIS_RATE;
    }
  });
});
