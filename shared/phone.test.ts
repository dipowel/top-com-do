import { describe, it, expect } from 'vitest';
import { normalizePhone, toE164, whatsappLink } from './phone';

describe('phone · normalizePhone', () => {
  it('limpia separadores y antepone el 1 de RD a un número local de 10 dígitos', () => {
    expect(normalizePhone('809-555-1234')).toBe('18095551234');
    expect(normalizePhone('(829) 555 1234')).toBe('18295551234');
    expect(normalizePhone('849 555 1234')).toBe('18495551234');
  });

  it('no duplica el 1 si el número ya trae código de país', () => {
    expect(normalizePhone('+1 809 555 1234')).toBe('18095551234');
    expect(normalizePhone('18095551234')).toBe('18095551234');
  });

  it('no inventa prefijo para números que no son de RD', () => {
    expect(normalizePhone('5551234')).toBe('5551234');
    expect(normalizePhone('34123456789')).toBe('34123456789');
  });

  it('vacío/nulo devuelve cadena vacía', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });
});

describe('phone · toE164', () => {
  it('antepone + al número normalizado', () => {
    expect(toE164('8095551234')).toBe('+18095551234');
    expect(toE164('+1 809 555 1234')).toBe('+18095551234');
  });

  it('vacío devuelve cadena vacía (sin "+" suelto)', () => {
    expect(toE164(null)).toBe('');
  });
});

describe('phone · whatsappLink', () => {
  it('arma el enlace api.whatsapp.com/send con teléfono normalizado y texto', () => {
    expect(whatsappLink('809-555-1234', 'Hola')).toBe(
      'https://api.whatsapp.com/send?phone=18095551234&text=Hola',
    );
  });

  it('sin teléfono, arma solo el enlace con texto (compartir sin contacto fijo)', () => {
    expect(whatsappLink(undefined, 'Hola')).toBe('https://api.whatsapp.com/send?text=Hola');
  });

  it('sin teléfono ni texto, apunta al endpoint pelado', () => {
    expect(whatsappLink()).toBe('https://api.whatsapp.com/send');
  });
});
