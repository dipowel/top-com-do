import { SITE_URL } from '../../shared/site';

/**
 * IndexNow: avisa a Bing (y Yandex) al instante de URLs nuevas o modificadas.
 * La clave es pública por diseño (vive en client/public/<clave>.txt). No bloquea
 * nunca la respuesta: se llama sin await y traga cualquier error.
 */
const KEY = process.env.INDEXNOW_KEY || 'cc3bf34dfe6e661f79e96853579598ac';
const HOST = SITE_URL.replace(/^https?:\/\//, '');

export function pingIndexNow(paths: string[]): void {
  const urlList = [...new Set(paths)]
    .map((p) => (p.startsWith('http') ? p : `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`))
    .slice(0, 100);
  if (!urlList.length) return;

  void fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${SITE_URL}/${KEY}.txt`,
      urlList,
    }),
  }).catch(() => {
    /* IndexNow es best-effort */
  });
}
