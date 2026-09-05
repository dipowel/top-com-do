/** Enlace de WhatsApp con el teléfono limpio y el "1" de RD antepuesto si falta. */
export { whatsappLink } from '@shared/phone';

/**
 * Avatar de respaldo (iniciales sobre fondo oscuro) como SVG local en un data URI.
 * Sin dependencia de terceros: evita una petición externa por cada logo ausente.
 */
export function avatarFallback(seed: string): string {
  const initials =
    (seed || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="24" fill="#0f172a"/>` +
    `<text x="64" y="64" dy=".35em" text-anchor="middle" ` +
    `font-family="system-ui,-apple-system,sans-serif" font-size="52" font-weight="700" fill="#d4af37">` +
    `${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Comparte una imagen (Web Share API con archivos) o la descarga como fallback. */
export async function shareImage(dataUrl: string, filename: string, title: string): Promise<void> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
  } catch {
    /* cae al fallback de descarga */
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
