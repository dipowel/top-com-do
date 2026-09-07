/**
 * Identidad del comercio — fuente única para footer, contacto, páginas legales y
 * el comprobante de pago. Requisito de la validación de la pasarela AZUL
 * (Servicios Digitales Populares). Módulo puro: lo usa el cliente y el servidor.
 */
export const COMPANY = {
  brand: 'Top.com.do',
  /** Razón social / titular (persona física). */
  legalName: 'Dipowel Pimentel Santana',
  /** Cédula de identidad (equivale al RNC para persona física). */
  taxId: '402-2572377-0',
  taxIdLabel: 'Cédula / RNC',

  address: {
    street: 'Carretera Mella, Calle Primera #22',
    sector: 'Sector Cristo Salvador, San Isidro',
    city: 'Santo Domingo Este',
    province: 'Provincia Santo Domingo',
    country: 'República Dominicana',
    full: 'Carretera Mella, Calle Primera #22, Sector Cristo Salvador, San Isidro, Santo Domingo Este, Provincia Santo Domingo, República Dominicana',
  },

  supportEmail: 'topcomdo15@gmail.com',
  /** E.164 para enlaces `tel:`. */
  phone: '+18296497160',
  phoneDisplay: '+1 (829) 649-7160',
  hours: 'Lunes a viernes, 9:00 AM – 6:00 PM',

  /** Pasarela de pago (procesador de tarjetas autorizado por Visa y Mastercard). */
  paymentGateway: 'AZUL',
  paymentGatewayLegal: 'AZUL — Servicios Digitales Populares, S.R.L.',
} as const;
