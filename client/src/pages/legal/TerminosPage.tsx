import LegalLayout from './LegalLayout';

export default function TerminosPage() {
  return (
    <LegalLayout
      title="Términos de Servicio"
      description="Términos de Servicio de Top.com.do: cómo funcionan las pujas por el puesto #1, pagos con Dodo Payments, no reembolsos y ley aplicable en la República Dominicana."
      path="/terminos"
    >
      <p>
        Bienvenido a <strong>Top.com.do</strong> (el "Servicio"), un directorio comercial de la
        República Dominicana que ordena a los negocios mediante una <strong>subasta semanal de
        visibilidad</strong>. Al crear una cuenta, publicar un negocio o realizar una puja, aceptas
        estos Términos.
      </p>

      <h2>1. Naturaleza del servicio</h2>
      <p>
        Top.com.do exhibe negocios por categoría y por provincia. La posición en el ranking de cada
        categoría y provincia depende de la <strong>suma de las pujas verificadas de cada negocio
        en los últimos 7 días</strong> (ventana móvil, sin reinicios de golpe). El Servicio no
        vende productos ni servicios de los negocios listados; únicamente ofrece visibilidad.
      </p>

      <h2>2. Pujas por el puesto #1</h2>
      <ul>
        <li>
          Las pujas se realizan en <strong>pesos dominicanos (RD$)</strong> por un monto libre que
          debe superar el total acumulado del negocio que va #1 en ese momento.
        </li>
        <li>
          Una puja es <strong>definitiva y no reembolsable</strong> una vez que el pago ha sido
          procesado por la pasarela. No se aceptan cancelaciones ni devoluciones por cambio de
          opinión.
        </li>
        <li>
          El puesto #1 <strong>no está garantizado en el tiempo</strong>: cualquier competidor
          puede superar tu total acumulado en tiempo real, y <strong>cada puja deja de contar a los
          7 días</strong>, así que hay que sostener el puesto con pujas nuevas. El que no defiende
          su posición baja automáticamente.
        </li>
        <li>
          El Servicio puede anular pujas y ajustar el ranking cuando un pago sea{' '}
          <strong>revertido, reclamado como contracargo o marcado como fraudulento</strong>.
        </li>
      </ul>

      <h2>3. Pagos</h2>
      <p>
        Los pagos se procesan a través de <strong>Dodo Payments</strong>, que actúa como
        procesador y <em>merchant of record</em>. Top.com.do <strong>no almacena datos de tarjetas
        </strong>. También puede usarse el saldo acumulado por el programa de referidos como medio
        de pago de una puja.
      </p>

      <h2>4. Cuentas y conducta</h2>
      <ul>
        <li>Debes proporcionar información veraz y mantener la confidencialidad de tu acceso.</li>
        <li>
          Está prohibido: suplantar negocios o personas, crear perfiles falsos o duplicados,
          manipular reseñas, usar múltiples cuentas para evadir límites, y cualquier uso que
          infrinja la ley dominicana.
        </li>
        <li>
          El incumplimiento puede derivar en la <strong>suspensión o eliminación</strong> de la
          cuenta y de los perfiles asociados, sin derecho a reembolso de pujas ya procesadas.
        </li>
      </ul>

      <h2>5. Reseñas</h2>
      <p>
        Las reseñas deben reflejar experiencias reales. Aplican controles antifraude descritos en
        las <a href="/normas">Normas</a>. El Servicio puede ocultar o eliminar reseñas que violen
        estas reglas.
      </p>

      <h2>6. Limitación de responsabilidad</h2>
      <p>
        El Servicio se presta "tal cual". Top.com.do no garantiza resultados comerciales derivados
        de aparecer en el ranking y no es responsable por las operaciones que los usuarios realicen
        con los negocios listados.
      </p>

      <h2>7. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de la <strong>República Dominicana</strong>, en
        particular la Ley No. 126-02 sobre Comercio Electrónico, Documentos y Firmas Digitales y la
        Ley No. 358-05 General de Protección de los Derechos del Consumidor. Cualquier controversia
        se someterá a los tribunales del Distrito Nacional, Santo Domingo.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Escríbenos a <a href="mailto:legal@top.com.do">legal@top.com.do</a> para cualquier consulta
        sobre estos Términos.
      </p>
    </LegalLayout>
  );
}
