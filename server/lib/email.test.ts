import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendEmail, emailConfigured, dethroneEmailHtml, receiptEmailHtml } from './email';

const prev = { ...process.env };
afterEach(() => {
  process.env = { ...prev };
  vi.restoreAllMocks();
});

describe('email', () => {
  it('emailConfigured refleja RESEND_API_KEY', () => {
    delete process.env.RESEND_API_KEY;
    expect(emailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = 're_x';
    expect(emailConfigured()).toBe(true);
  });

  it('sendEmail es no-op sin API key (no llama a fetch)', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('dethroneEmailHtml lleva el CTA con ?pujar=1 y los montos', () => {
    const html = dethroneEmailHtml({
      businessName: 'Pica Pollo El Rey',
      scopeLabel: 'Gastronomía y Comida · Santiago',
      newLeaderName: 'Pollo Vega',
      newLeaderTotalDop: 1500,
      minBidDop: 1600,
      profileId: 'abc',
    });
    expect(html).toContain('/p/abc?pujar=1');
    expect(html).toContain('Recuperar mi #1');
    expect(html).toMatch(/Pica Pollo El Rey/);
  });

  it('receiptEmailHtml incluye ID de factura, monto y link al recibo', () => {
    const html = receiptEmailHtml({
      businessName: 'Punto Parrillada 2',
      concept: 'Puja por visibilidad en el ranking — Punto Parrillada 2',
      orderNumber: 'TOP-20260907-A1B2C3',
      amountDop: 600,
      dateLabel: '7 de septiembre de 2026, 2:32 p.m.',
      bidId: 'bid-123',
    });
    expect(html).toContain('/recibo/bid-123');
    expect(html).toContain('TOP-20260907-A1B2C3');
    expect(html).toMatch(/Punto Parrillada 2/);
    expect(html).toMatch(/RD\$\s?600/);
  });
});
