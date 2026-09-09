import { Link } from 'react-router-dom';
import { COMPANY } from '@shared/company';
import SecurityBadges from '../../components/common/SecurityBadges';
import LegalLayout from './LegalLayout';

export default function SeguridadPagosPage() {
  return (
    <LegalLayout
      title="Políticas de Seguridad para la Transmisión de Datos de Tarjetas"
      description="Cómo Top.com.do protege los datos de pago: cifrado SSL/TLS y AES-256, cumplimiento PCI-DSS y procesamiento en la pasarela segura AZUL con 3D Secure."
      path="/seguridad-pagos"
    >
      <div className="flex justify-center py-2">
        <SecurityBadges variant="full" />
      </div>

      <h2>1. Compromiso de seguridad</h2>
      <p>
        <strong>{COMPANY.brand}</strong> ({COMPANY.legalName}) toma todas las medidas y precauciones
        razonables para proteger tu información personal y sigue las mejores prácticas de la
        industria para asegurar que tu información no sea utilizada de manera inapropiada, alterada
        o destruida.
      </p>

      <h2>2. Cifrado de la información</h2>
      <ul>
        <li>
          <strong>En tránsito:</strong> toda la comunicación entre tu navegador y nuestros
          servidores viaja cifrada con <strong>SSL/TLS</strong> (capa de puertos seguros / Secure
          Sockets Layer).
        </li>
        <li>
          <strong>En reposo:</strong> la información sensible se almacena con cifrado{' '}
          <strong>AES-256</strong>.
        </li>
        <li>
          Seguimos los requerimientos del estándar <strong>PCI-DSS</strong> (Payment Card Industry
          Data Security Standard).
        </li>
      </ul>

      <h2>3. Procesamiento de pagos por terceros</h2>
      <p>
        Los métodos de pago con tarjeta utilizados por {COMPANY.legalName} son{' '}
        <strong>servicios de terceros</strong>. El procesamiento lo realiza{' '}
        <strong>{COMPANY.paymentGatewayLegal}</strong>, un procesador de pagos autorizado por las
        marcas Visa y Mastercard que cumple con todos los estándares de seguridad y cifrado para
        mantener tu información segura. {COMPANY.paymentGateway} solo utilizará la información
        necesaria para completar el proceso requerido.
      </p>
      <p>
        <strong>
          {COMPANY.brand} no ve, no procesa ni almacena números de tarjeta ni credenciales
          bancarias
        </strong>
        : los datos de la tarjeta se ingresan y protegen exclusivamente en la{' '}
        <strong>Página de Pago de {COMPANY.paymentGateway}</strong> (alojada por el propio
        procesador). {COMPANY.brand} solo recibe de vuelta el resultado de la transacción (aprobada
        o declinada), el número de autorización y el número de tarjeta <em>enmascarado</em>. Te
        recomendamos leer también las políticas de privacidad de este proveedor.
      </p>

      <h2>4. Autenticación 3D Secure</h2>
      <p>
        Las transacciones se protegen con <strong>3D Secure</strong> —{' '}
        <strong>Visa Secure</strong> y <strong>Mastercard ID Check</strong> —, un protocolo que
        añade una verificación adicional de identidad del tarjetahabiente con el banco emisor antes
        de aprobar el cargo, reduciendo el riesgo de fraude y de uso no autorizado de la tarjeta.
      </p>

      <h2>5. Comprobante de pago</h2>
      <p>
        Cada transacción exitosa genera un{' '}
        <Link to="/recibo">comprobante de pago digital</Link> con número de orden, fecha, concepto,
        monto en RD$ y estado, disponible en tu cuenta.
      </p>

      <h2>6. Reportar un problema de seguridad</h2>
      <p>
        Escríbenos a <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. Consulta
        también la <a href="/privacidad">Política de Privacidad</a>,{' '}
        <a href="/devoluciones">Devoluciones</a> y <a href="/entrega">Entrega</a>.
      </p>
    </LegalLayout>
  );
}
