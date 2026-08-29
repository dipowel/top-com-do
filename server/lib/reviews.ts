import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import { reviews, profiles } from '../../shared/schema';
import { HttpError } from '../middleware/errorHandler';
import { notifyAdmins, notifyUser } from './notify';
import { audit } from './audit';
import { summarize } from '../../shared/reviews';
import type { ReviewSummary } from '../../shared/types';

const IP_PER_PROFILE_MAX = 1; // otra cuenta desde la misma IP no puede reseñar el mismo negocio
const IP_PER_DAY_MAX = 5; // reseñas por IP en 24 h (cualquier negocio)
const BOMB_WINDOW_MIN = 15;
const BOMB_COUNT = 3;
const BOMB_MAX_RATING = 2;

interface Ctx {
  profile: { id: string; ownerUserId: string | null };
  userId: string;
  ipHash: string;
  isAdmin: boolean;
}

/** Reglas antifraude. Los administradores las saltan por completo. */
export async function assertCanReview({ profile, userId, ipHash, isAdmin }: Ctx): Promise<void> {
  if (profile.ownerUserId && profile.ownerUserId === userId) {
    throw new HttpError(403, 'No puedes reseñar tu propio negocio.');
  }
  if (isAdmin) return;

  // 1) Misma IP, mismo negocio, distinta cuenta
  const sameIpSameProfile = await db
    .select({ n: sql<string>`count(*)` })
    .from(reviews)
    .where(
      and(
        eq(reviews.profileId, profile.id),
        eq(reviews.ipHash, ipHash),
        ne(reviews.userId, userId),
      ),
    );
  if (Number(sameIpSameProfile[0]?.n ?? 0) >= IP_PER_PROFILE_MAX) {
    throw new HttpError(429, 'Ya hay una reseña desde este dispositivo para este negocio.');
  }

  // 2) Límite diario por IP (cualquier negocio, excluyendo mis propias ediciones)
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const perDay = await db
    .select({ n: sql<string>`count(*)` })
    .from(reviews)
    .where(and(eq(reviews.ipHash, ipHash), ne(reviews.userId, userId), gte(reviews.createdAt, dayAgo)));
  if (Number(perDay[0]?.n ?? 0) >= IP_PER_DAY_MAX) {
    throw new HttpError(429, 'Demasiadas reseñas desde tu conexión. Intenta más tarde.');
  }
}

/** Si hay una ráfaga de reseñas negativas sobre un negocio, se ocultan y se avisa. */
export async function detectBombing(profileId: string): Promise<number> {
  const since = new Date(Date.now() - BOMB_WINDOW_MIN * 60 * 1000);
  const recentBad = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.profileId, profileId),
        eq(reviews.status, 'published'),
        lte(reviews.rating, BOMB_MAX_RATING),
        gte(reviews.createdAt, since),
      ),
    );

  if (recentBad.length < BOMB_COUNT) return 0;

  const ids = recentBad.map((r) => r.id);
  await db.update(reviews).set({ status: 'flagged' }).where(inArray(reviews.id, ids));

  const prof = (
    await db.select({ name: profiles.name, ownerUserId: profiles.ownerUserId }).from(profiles).where(eq(profiles.id, profileId)).limit(1)
  )[0];

  await notifyAdmins({
    type: 'review.bombing',
    title: '🚩 Posible sabotaje de reseñas',
    body: `${prof?.name ?? 'Un negocio'} recibió ${recentBad.length} reseñas negativas en pocos minutos. Se ocultaron para revisión.`,
    url: '/admin/resenas',
    meta: { profileId, count: recentBad.length },
  });
  if (prof?.ownerUserId) {
    await notifyUser(prof.ownerUserId, {
      type: 'review.bombing',
      title: '🛡️ Protegimos tu negocio',
      body: 'Detectamos varias reseñas negativas sospechosas y las pusimos en revisión. Un administrador las evaluará.',
      url: '/perfil',
    });
  }
  await audit(null, 'review.bombing.flagged', 'profile', profileId, { count: recentBad.length });
  return recentBad.length;
}

export async function reviewSummary(profileId: string): Promise<ReviewSummary> {
  const rows = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.profileId, profileId), eq(reviews.status, 'published')));
  return summarize(rows.map((r) => r.rating));
}
