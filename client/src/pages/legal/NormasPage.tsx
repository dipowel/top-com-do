import LegalLayout from './LegalLayout';
import { useNewModel } from '../../hooks/useNewModel';

export default function NormasPage() {
  const newModel = useNewModel();
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
      {newModel ? (
        <ul>
          <li>
            El ranking es <strong>100% orgánico</strong>: lo decide la calificación de tus clientes
            (reseñas reales verificadas), qué tan rápido respondes y qué tan completo está tu
            perfil. <strong>No se puede pagar para subir de posición.</strong>
          </li>
          <li>
            El orden se calcula por <strong>categoría × provincia</strong>: un negocio aparece a la
            vez a nivel nacional ("Todo RD") y dentro de su provincia (las 32 demarcaciones del
            país).
          </li>
          <li>
            Los planes pagados (<strong>Verificado</strong> y <strong>Destacado</strong>) dan
            identidad verificada, más fotos, estadísticas y, en el caso de Destacado, un espacio
            aparte etiquetado <strong>"PATROCINADO"</strong> — nunca mezclado con las posiciones
            reales del ranking ni usado para calcular tu puntaje.
          </li>
          <li>
            Los espacios "Destacado" están limitados a 3 por categoría y provincia; si están
            ocupados, tu solicitud queda en lista de espera hasta que se libere uno.
          </li>
        </ul>
      ) : (
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
            Una puja se considera verificada cuando su pago se confirma (AZUL) o cuando se
            paga con saldo de referidos. Los pagos revertidos o con contracargo{' '}
            <strong>anulan la puja</strong> y recalculan el ranking.
          </li>
        </ul>
      )}

      <h2>2. Reseñas y confianza</h2>
      <ul>
        <li>Solo usuarios registrados pueden calificar (1 a 5 estrellas) y comentar.</li>
        <li>
          <strong>Una reseña por usuario y por dispositivo (IP)</strong> para cada negocio. Otra
          cuenta desde la misma conexión no puede volver a reseñar el mismo negocio. Puedes
          actualizar tu propia reseña cuando quieras.
        </li>
        <li>
          El dueño de un negocio <strong>no puede reseñar su propio local</strong>; solo responder.
        </li>
        <li>
          Ante una <strong>ráfaga de reseñas negativas</strong> sospechosas en pocos minutos, esas
          reseñas se ocultan automáticamente y pasan a revisión de un administrador.
        </li>
        <li>
          <strong>Nadie puede pagar para que se elimine una reseña negativa real.</strong>
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
        El incumplimiento puede implicar la ocultación de contenido, la anulación de reseñas o
        pujas fraudulentas, la suspensión de perfiles y el cierre de la cuenta, según la gravedad.
        {newModel
          ? ' Los pagos de planes ya confirmados no se reembolsan'
          : ' Las pujas ya procesadas no se reembolsan'}{' '}
        (ver <a href="/terminos">Términos de Servicio</a>).
      </p>

      <h2>5. Reportes</h2>
      <p>
        Para reportar un perfil o una reseña sospechosa, escribe a{' '}
        <a href="mailto:soporte@top.com.do">soporte@top.com.do</a>.
      </p>
    </LegalLayout>
  );
}
