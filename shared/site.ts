/** URL oficial del sitio. Se usa para enlaces de compartir, referidos y metadatos. */
function resolveSiteUrl(): string {
  try {
    // Vite expone import.meta.env; en el servidor no existe (usa el default).
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (env?.VITE_SITE_URL) return env.VITE_SITE_URL.replace(/\/+$/, '');
  } catch {
    /* servidor */
  }
  return 'https://www.top.com.do';
}

export const SITE_URL = resolveSiteUrl();

export const refShareUrl = (code: string) => `${SITE_URL}/?ref=${encodeURIComponent(code)}`;
export const profileShareUrl = (id: string) => `${SITE_URL}/p/${id}`;
