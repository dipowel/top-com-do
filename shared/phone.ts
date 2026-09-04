/** Códigos de área válidos de la República Dominicana (NANP, +1). */
const DO_AREA_CODES = ['809', '829', '849'];

/**
 * Limpia un teléfono a solo dígitos y antepone el código de país "1" de RD
 * cuando falta (número local de 10 dígitos con área 809/829/849). No inventa
 * prefijos para números que ya traen código de país u otros formatos.
 */
export function normalizePhone(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10 && DO_AREA_CODES.includes(digits.slice(0, 3))) {
    return `1${digits}`;
  }
  return digits;
}

/** Formato E.164 (+1809...) para datos estructurados / enlaces `tel:`. */
export function toE164(raw?: string | null): string {
  const digits = normalizePhone(raw);
  return digits ? `+${digits}` : '';
}

/** Enlace "click to chat" de WhatsApp con el teléfono normalizado. */
export function whatsappLink(rawPhone?: string | null, text?: string): string {
  const phone = normalizePhone(rawPhone);
  const params: string[] = [];
  if (phone) params.push(`phone=${phone}`);
  if (text) params.push(`text=${encodeURIComponent(text)}`);
  return `https://api.whatsapp.com/send${params.length ? `?${params.join('&')}` : ''}`;
}
