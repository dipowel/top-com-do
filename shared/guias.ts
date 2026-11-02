/**
 * Contenido de /guias — artículos genéricos y honestos para dueños de negocio en RD (SEO de
 * adquisición, §10.1 del pedido original). Fuente única: cliente y servidor (SSR) leen de aquí.
 * Nada de estadísticas inventadas sobre Top ni comparaciones desleales con otras plataformas.
 */

export interface GuiaBlock {
  type: 'h2' | 'p' | 'li';
  text: string;
}

export interface Guia {
  slug: string;
  title: string;
  description: string;
  updatedAt: string; // YYYY-MM-DD
  blocks: GuiaBlock[];
}

export const GUIAS: Guia[] = [
  {
    slug: 'donde-publicar-tu-negocio-gratis-en-rd',
    title: 'Dónde publicar tu negocio gratis en República Dominicana (2026)',
    description:
      'Comparativa honesta de las opciones gratuitas para que tu negocio aparezca en internet en RD: Google Maps, Facebook, Instagram, Páginas Amarillas y Top.com.do.',
    updatedAt: '2026-11-02',
    blocks: [
      { type: 'p', text: 'Si tienes un negocio en República Dominicana, hoy existen varias formas gratuitas de que tus clientes te encuentren en internet. Ninguna sustituye a las otras — lo ideal es combinarlas.' },
      { type: 'h2', text: 'Google Maps (Google Business Profile)' },
      { type: 'p', text: 'Es gratis y probablemente el primer lugar donde buscan tus clientes cuando escriben "cerca de mí". Te permite recibir reseñas, mostrar horarios y fotos. Requiere verificación (por correo, teléfono o video) y puede tardar varios días en activarse.' },
      { type: 'h2', text: 'Facebook e Instagram' },
      { type: 'p', text: 'Buenos para mostrar tu trabajo con fotos y videos, y para que los clientes te escriban directo. La desventaja: no estás organizado por categoría ni provincia, así que es difícil que te encuentre alguien que no te conoce ya.' },
      { type: 'h2', text: 'Páginas Amarillas / directorios tradicionales' },
      { type: 'p', text: 'Siguen existiendo, pero la mayoría de búsquedas hoy pasan por Google o redes sociales, no por un directorio impreso o su versión digital.' },
      { type: 'h2', text: 'Top.com.do' },
      { type: 'p', text: 'Es un directorio de negocios y empleos organizado por categoría y provincia, con reseñas reales de clientes y contacto directo por WhatsApp. Registrarte es gratis y tu ficha queda indexada por Google como una página propia de tu negocio.' },
      { type: 'h2', text: 'Nuestra recomendación' },
      { type: 'p', text: 'No elijas uno solo. Crea tu Google Business Profile, mantén tus redes activas, y regístrate en Top.com.do para aparecer también en un ranking organizado por zona — son gratis y se complementan.' },
    ],
  },
  {
    slug: 'como-poner-tu-negocio-en-google-maps',
    title: 'Cómo poner tu negocio en Google Maps paso a paso',
    description: 'Guía paso a paso para crear y verificar tu ficha de Google Business Profile en República Dominicana.',
    updatedAt: '2026-11-02',
    blocks: [
      { type: 'p', text: 'Aparecer en Google Maps es gratis. Estos son los pasos reales para lograrlo.' },
      { type: 'h2', text: '1. Crea tu cuenta de Google Business Profile' },
      { type: 'p', text: 'Entra a business.google.com e inicia sesión con una cuenta de Google (puede ser una nueva, dedicada a tu negocio).' },
      { type: 'h2', text: '2. Agrega el nombre y la categoría exacta de tu negocio' },
      { type: 'p', text: 'Usa el nombre real como lo conocen tus clientes, y elige la categoría más específica posible (por ejemplo "Barbería" en vez de solo "Belleza").' },
      { type: 'h2', text: '3. Marca tu ubicación en el mapa' },
      { type: 'p', text: 'Si atiendes clientes en un local físico, marca la dirección exacta. Si trabajas a domicilio o por delivery, puedes ocultar la dirección y solo mostrar el área de servicio.' },
      { type: 'h2', text: '4. Verifica tu negocio' },
      { type: 'p', text: 'Google te pedirá verificar que el negocio es real, normalmente por video, código postal o llamada telefónica. Sin este paso tu ficha no aparece en las búsquedas.' },
      { type: 'h2', text: '5. Completa tu perfil' },
      { type: 'p', text: 'Agrega horario, teléfono, fotos reales del lugar o del trabajo, y una descripción corta. Mientras más completo esté, más confianza genera.' },
      { type: 'h2', text: '6. Pide tus primeras reseñas' },
      { type: 'p', text: 'Comparte el enlace directo de tu ficha con tus clientes satisfechos y pídeles una reseña honesta — es lo que más influye en que aparezcas arriba.' },
      { type: 'p', text: 'Este mismo principio (perfil completo + reseñas reales) es exactamente lo que determina tu posición en Top.com.do — vale la pena hacerlo en ambos lugares.' },
    ],
  },
  {
    slug: 'como-conseguir-mas-clientes-por-whatsapp',
    title: 'Cómo conseguir más clientes por WhatsApp',
    description: 'Consejos prácticos para que tu negocio reciba más consultas y ventas a través de WhatsApp en República Dominicana.',
    updatedAt: '2026-11-02',
    blocks: [
      { type: 'p', text: 'WhatsApp es, para la mayoría de negocios pequeños en RD, el canal donde de verdad se cierran las ventas. Estos son los puntos que más impacto tienen.' },
      { type: 'h2', text: 'Haz que te encuentren con tu número a la vista' },
      { type: 'p', text: 'Pon tu WhatsApp en todos los lugares donde apareces: redes sociales, Google Maps, y cualquier directorio donde estés registrado — incluyendo Top.com.do, donde el botón de WhatsApp va directo a tu número.' },
      { type: 'h2', text: 'Responde rápido, sobre todo al principio' },
      { type: 'p', text: 'La mayoría de clientes le escriben a 2 o 3 negocios a la vez. El que responde primero (y bien) suele quedarse con la venta, aunque no sea el más barato.' },
      { type: 'h2', text: 'Usa WhatsApp Business' },
      { type: 'p', text: 'Es gratis y te da catálogo de productos, respuestas rápidas guardadas y un mensaje automático de bienvenida — todo dentro de la misma app que ya usas.' },
      { type: 'h2', text: 'Deja que el cliente te escriba sin fricción' },
      { type: 'p', text: 'Evita pedir que "llamen primero" o que "manden correo". Entre más pasos tenga que dar alguien para contactarte, más clientes pierdes en el camino.' },
      { type: 'h2', text: 'Pide la reseña después de atender bien' },
      { type: 'p', text: 'Un cliente contento que acaba de recibir buen servicio es el momento ideal para pedirle, por el mismo WhatsApp, que te deje una reseña — en Google o en Top.com.do.' },
    ],
  },
  {
    slug: 'como-conseguir-resenas-de-clientes',
    title: 'Cómo conseguir reseñas de tus clientes',
    description: 'Cómo pedir reseñas reales a tus clientes de forma honesta, y por qué son la base del ranking orgánico de Top.com.do.',
    updatedAt: '2026-11-02',
    blocks: [
      { type: 'p', text: 'Las reseñas reales son, hoy, una de las formas más efectivas de ganar confianza — más que cualquier anuncio pagado. Así se consiguen de verdad.' },
      { type: 'h2', text: 'Pide justo después del buen servicio' },
      { type: 'p', text: 'El mejor momento es inmediatamente después de entregar lo que prometiste, mientras el cliente todavía está contento.' },
      { type: 'h2', text: 'Facilita el proceso al máximo' },
      { type: 'p', text: 'Manda un enlace directo (no le pidas que busque tu negocio por su cuenta). En Top.com.do, cada negocio registrado tiene su propio enlace corto de reseñas para compartir por WhatsApp desde el panel.' },
      { type: 'h2', text: 'Nunca compres ni fabriques reseñas' },
      { type: 'p', text: 'Las reseñas falsas se notan, y en plataformas serias se detectan y se eliminan. En Top.com.do, el ranking usa un sistema que detecta patrones sospechosos (ráfagas de reseñas negativas o positivas) y las revisa antes de contarlas.' },
      { type: 'h2', text: 'Responde todas las reseñas, buenas y malas' },
      { type: 'p', text: 'Una respuesta profesional a una reseña negativa muchas veces genera más confianza que ocultarla. En Top.com.do el dueño del negocio puede responder directamente debajo de cada reseña.' },
      { type: 'h2', text: 'Por qué importa para tu posición en el ranking' },
      { type: 'p', text: 'En el ranking orgánico de Top.com.do, la posición de tu negocio depende de tus reseñas reales, qué tan rápido respondes y qué tan completo está tu perfil — nunca de cuánto pagas.' },
    ],
  },
  {
    slug: 'como-publicar-una-vacante-gratis-en-rd',
    title: 'Cómo publicar una vacante de empleo gratis en República Dominicana',
    description: 'Paso a paso para publicar una oferta de empleo gratis en Top.com.do y que llegue a más candidatos.',
    updatedAt: '2026-11-02',
    blocks: [
      { type: 'p', text: 'Publicar una vacante en Top.com.do es gratis y toma pocos minutos. Esto es lo que necesitas antes de empezar.' },
      { type: 'h2', text: '1. Define el puesto con claridad' },
      { type: 'p', text: 'Título exacto, responsabilidades principales y requisitos reales — evita listas genéricas, los buenos candidatos filtran rápido las vacantes poco claras.' },
      { type: 'h2', text: '2. Decide cómo recibirás las aplicaciones' },
      { type: 'p', text: 'Puedes recibirlas por correo, por un enlace externo, o dejar que te escriban directo por WhatsApp — esto último suele traer respuestas más rápidas en RD.' },
      { type: 'h2', text: '3. Publica en top.com.do/empleos/publicar' },
      { type: 'p', text: 'Completa el formulario con el puesto, la categoría, la ubicación y el tipo de contrato (tiempo completo, medio tiempo, remoto, etc.). La vacante queda publicada de inmediato, sin costo.' },
      { type: 'h2', text: '4. Si necesitas llenar la posición urgente' },
      { type: 'p', text: 'Existe la opción de pago "Vacante urgente", que destaca tu vacante arriba del listado por 7 días para que la vean más candidatos primero.' },
      { type: 'h2', text: '5. Vincula tu negocio' },
      { type: 'p', text: 'Si ya tienes tu negocio registrado en Top.com.do, vincula la vacante a tu ficha — los candidatos pueden ver tu perfil real, reseñas incluidas, antes de aplicar.' },
    ],
  },
];

export function getGuia(slug: string): Guia | undefined {
  return GUIAS.find((g) => g.slug === slug);
}

export const GUIA_SLUGS = GUIAS.map((g) => g.slug);
