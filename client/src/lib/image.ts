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

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(compressed);
  });
}
