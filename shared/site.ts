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

/**
 * URL pública y cacheable del logo/avatar de un negocio. La imagen vive como
 * data URI base64 en la BD; este endpoint la decodifica y la sirve con caché
 * de 1 año, de modo que sea usable en `<img>`, Open Graph y datos estructurados.
 * Devuelve `null` cuando el negocio no tiene logo (el cliente pinta el fallback).
 */
export const profileAvatarUrl = (id: string, avatarUrl?: string | null): string | null => {
  if (!avatarUrl) return null;
  if (/^https?:\/\//.test(avatarUrl)) return avatarUrl;
  return `${SITE_URL}/api/profiles/${id}/avatar`;
};

/** true si el string es un data URI de imagen (lo que guarda el formulario de perfil). */
export const isDataImage = (v?: string | null): boolean => !!v && /^data:image\//.test(v);

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
