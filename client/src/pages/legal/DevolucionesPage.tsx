import { COMPANY } from '@shared/company';
import LegalLayout from './LegalLayout';

export default function DevolucionesPage() {
  return (
    <LegalLayout
      title="Políticas de Devoluciones, Reembolsos y Cancelaciones"
      description="Derechos del tarjetahabiente, plazos y condiciones para reembolsos y cancelaciones de pagos en Top.com.do, procesados por la pasarela AZUL."
      path="/devoluciones"
    >
      <p>
        Esta política describe cómo <strong>{COMPANY.brand}</strong> (operado por{' '}
        {COMPANY.legalName}) maneja las cancelaciones, devoluciones y reembolsos de los pagos
        realizados en la plataforma. Todos los pagos con tarjeta se procesan a través de la pasarela
        segura <strong>{COMPANY.paymentGateway}</strong>.
      </p>

      <h2>1. Qué se paga en Top.com.do</h2>
      <p>
        El único cobro de la plataforma es la <strong>puja por visibilidad</strong>: un aporte en
        pesos dominicanos (RD$) que suma a la posición de un negocio en el ranking de su categoría y
        provincia durante la ventana móvil de 7 días. Registrar un negocio en el directorio es
        gratuito. No se venden productos físicos.
      </p>

      <h2>2. Naturaleza del servicio (ejecución inmediata)</h2>
      <p>
        La puja es un <strong>servicio digital que se ejecuta de inmediato</strong>: al confirmarse
        el pago, el monto se acredita al instante en el ranking y produce efecto (mayor visibilidad)
        desde ese momento. Por esta razón, y conforme a la práctica del comercio electrónico, una
        puja <strong>no es reembolsable por cambio de opinión</strong> una vez procesada.
      </p>

      <h2>3. Casos en los que SÍ procede un reembolso</h2>
      <ul>
        <li><strong>Cobro duplicado</strong> por el mismo concepto y monto.</li>
        <li>
          <strong>Error técnico</strong> comprobable de la plataforma o de la pasarela que impidió
          recibir el servicio (por ejemplo, el pago se cobró pero la puja no se registró).
        </li>
        <li>
          <strong>Cargo no reconocido / fraude</strong>: si no reconoces una transacción, escríbenos
          de inmediato y también contacta al banco emisor de tu tarjeta.
        </li>
        <li>Cuando lo ordene una autoridad competente o lo exija la ley dominicana.</li>
      </ul>

      <h2>4. Cómo solicitar un reembolso o cancelación</h2>
      <p>
        Escribe a <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> dentro de los{' '}
        <strong>7 días calendario</strong> siguientes al cargo, indicando: correo de la cuenta,
        número de orden del comprobante, fecha y monto. Respondemos en un máximo de{' '}
        <strong>2 días hábiles</strong>.
      </p>

      <h2>5. Plazos y medio de devolución</h2>
      <p>
        Los reembolsos aprobados se realizan <strong>por la misma tarjeta y vía de pago</strong>{' '}
        utilizada, a través de {COMPANY.paymentGateway}. El abono suele reflejarse en el estado de
        cuenta del tarjetahabiente en un plazo de <strong>5 a 15 días hábiles</strong>, según los
        tiempos del banco emisor.
      </p>

      <h2>6. Contracargos</h2>
      <p>
        Si un pago se revierte, se reclama como contracargo o se marca como fraudulento, la puja
        correspondiente se <strong>anula</strong> y el ranking se ajusta. El uso indebido de
        contracargos puede derivar en la suspensión de la cuenta.
      </p>

      <h2>7. Contacto</h2>
      <p>
        {COMPANY.legalName} · {COMPANY.address.full} ·{' '}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> ·{' '}
        <a href={`tel:${COMPANY.phone}`}>{COMPANY.phoneDisplay}</a>. Horario: {COMPANY.hours}.
      </p>
    </LegalLayout>
  );
}
