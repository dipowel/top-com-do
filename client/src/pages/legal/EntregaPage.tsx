import { COMPANY } from '@shared/company';
import LegalLayout from './LegalLayout';

export default function EntregaPage() {
  return (
    <LegalLayout
      title="Política de Entrega"
      description="Cómo y cuándo se entrega el servicio de Top.com.do: directorio y pujas por visibilidad, un servicio 100% digital de activación inmediata."
      path="/entrega"
    >
      <p>
        <strong>{COMPANY.brand}</strong> ({COMPANY.legalName}) presta un <strong>servicio 100%
        digital</strong>. No hay envío de productos físicos ni logística de paquetería: la "entrega"
        es la activación del servicio contratado dentro de la plataforma.
      </p>

      <h2>1. Registro de negocio (gratuito)</h2>
      <p>
        Al completar el formulario de alta, el negocio se publica en el directorio{' '}
        <strong>de forma inmediata</strong> y queda visible en{' '}
        <a href="/explorar">Explorar</a> y en las páginas de su categoría y provincia.
      </p>

      <h2>2. Puja por visibilidad (de pago)</h2>
      <ul>
        <li>
          Tras confirmarse el pago con tarjeta a través de la pasarela{' '}
          <strong>{COMPANY.paymentGateway}</strong>, el monto de la puja se{' '}
          <strong>acredita en el ranking de inmediato</strong> (normalmente en segundos; hasta unos
          minutos si la confirmación del banco tarda).
        </li>
        <li>
          El efecto (subir posiciones en la categoría y provincia) es visible desde ese mismo
          momento y se mantiene durante la <strong>ventana móvil de 7 días</strong>; cada puja deja
          de contar al cumplirse ese plazo.
        </li>
        <li>
          Recibes un <a href="/recibo">comprobante de pago digital</a> con el número de orden, la
          fecha, el concepto, el monto en RD$ y el estado.
        </li>
      </ul>

      <h2>3. Acceso al servicio</h2>
      <p>
        El servicio se accede en <a href="https://www.top.com.do">www.top.com.do</a> con la cuenta
        del usuario (sección <a href="/mis-pujas">Mis pujas</a> y{' '}
        <a href="/perfil">Perfil</a>), disponible <strong>24 horas, 7 días a la semana</strong>.
      </p>

      <h2>4. Incidencias en la entrega</h2>
      <p>
        Si pagaste y la puja no aparece acreditada en un plazo razonable, entra a{' '}
        <a href="/mis-pujas">Mis pujas</a> y pulsa "Ya pagué — revisar ahora", o escríbenos a{' '}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. Ver también las{' '}
        <a href="/devoluciones">Políticas de Devoluciones y Reembolsos</a>.
      </p>

      <h2>5. Contacto</h2>
      <p>
        {COMPANY.legalName} · {COMPANY.address.full} ·{' '}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> ·{' '}
        <a href={`tel:${COMPANY.phone}`}>{COMPANY.phoneDisplay}</a>. Horario: {COMPANY.hours}.
      </p>
    </LegalLayout>
  );
}
