import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { reviews, profiles } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';
import { notifyUser } from '../lib/notify';
import { REVIEW_COMMENT_MAX } from '../../shared/reviews';

const r = Router();

r.delete(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const row = await db.select().from(reviews).where(eq(reviews.id, req.params.id)).limit(1);
    if (!row[0]) throw new HttpError(404, 'Reseña no encontrada');
    const isAdmin = req.user!.role !== 'user';
    if (row[0].userId !== req.user!.id && !isAdmin) throw new HttpError(403, 'No autorizado');
    await db.delete(reviews).where(eq(reviews.id, req.params.id));
    await audit(req.user!.id, 'review.delete', 'review', req.params.id, { by: isAdmin ? 'admin' : 'author' });
    res.json({ ok: true });
  }),
);

r.post(
  '/:id/reply',
  requireAuth,
  ah(async (req, res) => {
    const { reply } = z.object({ reply: z.string().min(1).max(REVIEW_COMMENT_MAX) }).parse(req.body);
    const row = (
      await db
        .select({
          id: reviews.id,
          userId: reviews.userId,
          profileId: reviews.profileId,
          profileName: profiles.name,
          ownerUserId: profiles.ownerUserId,
        })
        .from(reviews)
        .innerJoin(profiles, eq(profiles.id, reviews.profileId))
        .where(eq(reviews.id, req.params.id))
        .limit(1)
    )[0];
    if (!row) throw new HttpError(404, 'Reseña no encontrada');

    const isAdmin = req.user!.role !== 'user';
    if (row.ownerUserId !== req.user!.id && !isAdmin) {
      throw new HttpError(403, 'Solo el dueño del negocio puede responder.');
    }

    await db
      .update(reviews)
      .set({ ownerReply: reply.trim(), ownerReplyAt: new Date() })
      .where(eq(reviews.id, req.params.id));

    await notifyUser(row.userId, {
      type: 'review.reply',
      title: `💬 ${row.profileName} respondió tu reseña`,
      body: reply.trim().slice(0, 120),
      url: `/p/${row.profileId}`,
    });
    await audit(req.user!.id, 'review.reply', 'review', req.params.id, {});
    res.json({ ok: true });
  }),
);

export default r;
