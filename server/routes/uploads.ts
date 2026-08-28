import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { bids, paymentReceipts } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';

const r = Router();

const schema = z.object({
  bidId: z.string().uuid(),
  // data URL de imagen o PDF, ya comprimido en el cliente
  dataUrl: z
    .string()
    .regex(/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i, 'Sube una foto (JPG/PNG) o un PDF'),
  filename: z.string().max(160).optional(),
});

const MAX_BYTES = 2_000_000;

r.post(
  '/receipt',
  requireAuth,
  ah(async (req, res) => {
    const body = schema.parse(req.body);

    const b64 = body.dataUrl.slice(body.dataUrl.indexOf(',') + 1);
    const bytes = Math.floor((b64.length * 3) / 4);
    if (bytes > MAX_BYTES) {
      throw new HttpError(413, 'El archivo pesa demasiado. Usa una foto más liviana o un PDF menor a 1.5 MB.');
    }
    const mime = body.dataUrl.slice(5, body.dataUrl.indexOf(';'));

    const bid = await db.select().from(bids).where(eq(bids.id, body.bidId)).limit(1);
    if (!bid[0]) throw new HttpError(404, 'Puja no encontrada');
    if (bid[0].userId !== req.user!.id && req.user!.role === 'user') {
      throw new HttpError(403, 'No autorizado');
    }

    // Si hay Vercel Blob configurado, se guarda ahí; si no, va inline en la BD.
    let fileUrl = body.dataUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import('@vercel/blob');
        const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] || 'jpg';
        const blob = await put(
          `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
          Buffer.from(b64, 'base64'),
          { access: 'public', contentType: mime, token: process.env.BLOB_READ_WRITE_TOKEN },
        );
        fileUrl = blob.url;
      } catch (e) {
        console.error('[uploads] Blob falló, se guarda inline:', (e as Error).message);
      }
    }

    // Reemplaza el comprobante anterior de esta puja, si existía.
    await db.delete(paymentReceipts).where(eq(paymentReceipts.bidId, body.bidId));
    const inserted = await db
      .insert(paymentReceipts)
      .values({
        bidId: body.bidId,
        fileUrl,
        fileMime: mime,
        fileSize: bytes,
        uploadedByUserId: req.user!.id,
      })
      .returning();

    await audit(req.user!.id, 'receipt.upload', 'bid', body.bidId, {
      mime,
      bytes,
      stored: fileUrl.startsWith('data:') ? 'inline' : 'blob',
    });
    res.status(201).json({ receipt: inserted[0] });
  }),
);

export default r;
