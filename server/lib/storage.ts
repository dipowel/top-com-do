/** Sube un comprobante a Vercel Blob y devuelve su URL pública.
 *  `@vercel/blob` se carga de forma perezosa (no en el arranque de la función). */
export async function uploadReceipt(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN no está configurada');
  }
  const { put } = await import('@vercel/blob');

  const safe = originalName.replace(/[^\w.\-]+/g, '_').slice(-60) || 'comprobante';
  const key = `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

  const blob = await put(key, buffer, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}
