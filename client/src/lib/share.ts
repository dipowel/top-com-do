/** Enlace de WhatsApp con el teléfono limpio y el "1" de RD antepuesto si falta. */
export { whatsappLink } from '@shared/phone';

export function avatarFallback(seed: string): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1e293b,0f172a&textColor=d4af37`;
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
