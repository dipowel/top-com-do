import { Router } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { bids, paymentReceipts } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { uploadReceipt } from '../lib/storage';
import { audit } from '../lib/audit';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

// Validación tolerante: por extensión, no por MIME (Safari/iOS a veces envía MIME vacío o "image/jpg").
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'pdf'];

const r = Router();

r.post(
  '/receipt',
  requireAuth,
  upload.single('file'),
  ah(async (req, res) => {
    const bidId = String(req.body.bidId || '');
    if (!bidId) throw new HttpError(400, 'Falta el identificador de la puja');
    if (!req.file) throw new HttpError(400, 'Falta el archivo del comprobante');

    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      throw new HttpError(400, 'Formato no permitido. Sube una foto (JPG/PNG) o un PDF.');
    }

    const bid = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid[0]) throw new HttpError(404, 'Puja no encontrada');
    if (bid[0].userId !== req.user!.id && req.user!.role === 'user') {
      throw new HttpError(403, 'No autorizado');
    }

    const contentType =
      req.file.mimetype && req.file.mimetype !== 'application/octet-stream'
        ? req.file.mimetype
        : ext === 'pdf'
          ? 'application/pdf'
          : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    const url = await uploadReceipt(req.file.buffer, req.file.originalname || `comprobante.${ext}`, contentType);

    const inserted = await db
      .insert(paymentReceipts)
      .values({
        bidId,
        fileUrl: url,
        fileMime: contentType,
        fileSize: req.file.size,
        uploadedByUserId: req.user!.id,
      })
      .returning();

    await audit(req.user!.id, 'receipt.upload', 'bid', bidId, { url });
    res.status(201).json({ receipt: inserted[0] });
  }),
);

export default r;
