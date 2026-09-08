/**
 * Analítica ligera de eventos (Vercel Analytics). Nunca envía PII ni coordenadas.
 * Si @vercel/analytics no está disponible o falla, es un no-op silencioso.
 */
type JobEvent =
  | 'job_search'
  | 'job_view'
  | 'job_apply_click'
  | 'job_whatsapp_click'
  | 'job_share'
  | 'job_filter'
  | 'job_post_start'
  | 'job_post_complete';

export function track(event: JobEvent, props?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  import('@vercel/analytics')
    .then((m) => m.track(event, props))
    .catch(() => {
      /* no-op */
    });
}
