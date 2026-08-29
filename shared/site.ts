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

/** Redes sociales oficiales de la plataforma (para el footer y `sameAs` de los metadatos). */
export const SOCIAL_LINKS = [
  {
    name: 'Instagram',
    label: '@top.com.do',
    url: 'https://www.instagram.com/top.com.do?igsi=d3lhZ3VycWx5eWph',
  },
  { name: 'X', label: '@topcomdo', url: 'https://x.com/topcomdo?s=11' },
  {
    name: 'TikTok',
    label: '@top.com.do',
    url: 'https://www.tiktok.com/@top.com.do?_r=1&_t=ZS-99I1BmVaM2m',
  },
] as const;

export const SOCIAL_URLS: string[] = SOCIAL_LINKS.map((s) => s.url);
