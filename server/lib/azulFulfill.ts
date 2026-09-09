import { eq } from 'drizzle-orm';
import { db } from '../db';
import { azulPayments, bids } from '../../shared/schema';
import type { AzulPayment } from '../../shared/schema';
import { creditVerifiedBid } from './fulfillBid';
import { azulIsApproved } from './azul';
import { audit } from './audit';

const s = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

/** DOP a partir del `Amount` de respuesta de AZUL (string de centavos). */
function azulAmountToDop(amount: unknown): number | null {
  const n = Number(String(amount ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

/**
 * Procesa la respuesta VERIFICADA de AZUL para un intento de pago. El llamador ya
 * comprobó el `AuthHash`. Idempotente.
 */
export async function fulfillAzulBid(
  row: AzulPayment,
  params: Record<string, unknown>,
): Promise<'verified' | 'already' | 'declined' | 'not_found'> {
  const approved = azulIsApproved(params);
  const patch = {
    status: approved ? ('approved' as const) : ('declined' as const),
    azulOrderId: s(params.AzulOrderId),
    authorizationCode: s(params.AuthorizationCode),
    rrn: s(params.RRN),
    isoCode: s(params.IsoCode ?? params.ISOCode),
    responseCode: s(params.ResponseCode),
    responseMessage: s(params.ResponseMessage),
    errorDescription: s(params.ErrorDescription),
    dateTime: s(params.DateTime),
    cardNumberMasked: s(params.CardNumber),
    dataVaultBrand: s(params.DataVaultBrand),
    raw: params as object,
    updatedAt: new Date(),
  };
  await db.update(azulPayments).set(patch).where(eq(azulPayments.id, row.id));

  if (!approved) {
    await audit(null, 'bid.azul.declined', 'bid', row.bidId, {
      order: row.orderNumber,
      iso: patch.isoCode,
      msg: patch.responseMessage,
    });
    // Puja no pagada: se retira para no dejar `pending` colgando.
    await db.delete(bids).where(eq(bids.id, row.bidId));
    return 'declined';
  }

  const result = await creditVerifiedBid({
    bidId: row.bidId,
    finalDop: azulAmountToDop(params.Amount),
    reference: `AZUL ${patch.authorizationCode ?? row.orderNumber}`.trim(),
    providerLabel: 'AZUL',
  });
  return result;
}
