import LegalLayout from './LegalLayout';

export default function NormasPage() {
  return (
    <LegalLayout
      title="Normas de Top.com.do"
      description="Cómo funciona el algoritmo de ranking por provincias y categorías, y las políticas contra perfiles fraudulentos y manipulación de reseñas."
      path="/normas"
    >
      <p>
        Estas Normas explican, de forma transparente, cómo se ordena el directorio y qué conductas
        no se permiten.
      </p>

      <h2>1. Cómo funciona el ranking</h2>
      <ul>
        <li>
          El puesto de cada negocio = <strong>suma de sus pujas verificadas de los últimos 7
          días</strong> (ventana móvil). No hay reinicio de golpe: cada puja "envejece" y deja de
          contar sola al cumplir 7 días.
        </li>
        <li>
          El orden se calcula por <strong>categoría × provincia</strong>: un negocio compite a la
          vez a nivel nacional ("Todo RD") y dentro de su provincia (las 32 demarcaciones del
          país), con la misma puja.
        </li>
        <li>
          El <strong>#1 es siempre superable</strong> en tiempo real: quien acumule más en la
          ventana, lidera. El negocio que deja de pujar ve bajar su total día a día y un
          competidor lo pasa. <strong>El que no defiende su puesto, baja.</strong>
        </li>
        <li>
          Una puja se considera verificada cuando su pago se confirma (Dodo Payments) o cuando se
          paga con saldo de referidos. Los pagos revertidos o con contracargo{' '}
          <strong>anulan la puja</strong> y recalculan el ranking.
        </li>
      </ul>

      <h2>2. Reseñas y confianza</h2>
      <ul>
        <li>Solo usuarios registrados pueden calificar (1 a 5 estrellas) y comentar.</li>
        <li>
          <strong>Una reseña por usuario y por dispositivo (IP)</strong> para cada negocio. Otra
          cuenta desde la misma conexión no puede volver a reseñar el mismo negocio.
        </li>
        <li>
          El dueño de un negocio <strong>no puede reseñar su propio local</strong>; solo responder.
        </li>
        <li>
          Ante una <strong>ráfaga de reseñas negativas</strong> sospechosas en pocos minutos, esas
          reseñas se ocultan automáticamente y pasan a revisión de un administrador.
        </li>
      </ul>

      <h2>3. Perfiles y cuentas</h2>
      <ul>
        <li>
          Prohibidos los <strong>perfiles falsos, duplicados o de suplantación</strong> de
          negocios, marcas o personas. Se desactivan sin previo aviso.
        </li>
        <li>
          Prohibido usar <strong>múltiples cuentas</strong> para inflar reseñas, evadir límites o
          manipular el ranking.
        </li>
        <li>
          Las cuentas con rol de administrador que prueban el sistema están exentas de los límites
          de IP y multicuenta, pero <strong>tampoco pueden reseñar negocios propios</strong>.
        </li>
      </ul>

      <h2>4. Consecuencias</h2>
      <p>
        El incumplimiento puede implicar la ocultación de contenido, la anulación de pujas, la
        suspensión de perfiles y el cierre de la cuenta, según la gravedad. Las pujas ya procesadas
        no se reembolsan (ver <a href="/terminos">Términos de Servicio</a>).
      </p>

      <h2>5. Reportes</h2>
      <p>
        Para reportar un perfil o una reseña sospechosa, escribe a{' '}
        <a href="mailto:soporte@top.com.do">soporte@top.com.do</a>.
      </p>
    </LegalLayout>
  );
}
