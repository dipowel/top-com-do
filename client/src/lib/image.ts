import imageCompression from 'browser-image-compression';

/**
 * Comprime una imagen y la devuelve como data URL lista para guardar en el
 * campo `avatarUrl` del perfil (sin necesidad de storage externo).
 * Objetivo ~256px / ~40KB.
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 320,
    maxSizeMB: 0.08,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.72,
  }).catch(() => file);

  return fileToDataUrl(compressed);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime un comprobante (foto) para enviarlo. Más grande que un logo porque
 * el texto debe quedar legible. Objetivo ~1400px / ~280KB.
 */
export async function fileToReceiptDataUrl(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > 1_500_000) {
      throw new Error('PDF muy pesado (máx ~1.5 MB). Envía una foto en su lugar.');
    }
    return fileToDataUrl(file);
  }
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1400,
    maxSizeMB: 0.28,
    useWebWorker: true,
    initialQuality: 0.7,
  }).catch(() => file);
  return fileToDataUrl(compressed);
}
