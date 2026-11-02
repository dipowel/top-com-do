import { and, eq, lt, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { profiles, reviews, businessEvents } from '../../shared/schema';
import { computeRankScore } from '../../shared/rankScore';
import { computeProfileCompleteness } from '../../shared/profileCompleteness';
import { getRankings, getNearbyRankings } from './rankings';
import { getOrganicRankings, getOrganicNearbyRankings } from './rankingsOrganic';
import type { RankingEntry, NearbyRankingEntry } from '../../shared/types';

/** Flag de servidor: ¿está activo el ranking v2 (orgánico, por reseñas)? Mientras sea `false`
 *  (por defecto), todo sigue exactamente igual que hoy (pujas) — rollback instantáneo con solo
 *  quitar la env var. Mismo patrón que `isBetaOpen()` en `founders.ts`. */
export function isNewModelEnabled(): boolean {
  return (process.env.NEW_MODEL_ENABLED || '').trim().toLowerCase() === 'true';
}

/** Punto único de decisión: qué ranking usa el resto de la app. */
export async function getActiveRankings(
  categorySlug?: string,
  provinceSlug?: string,
  limit = 100,
): Promise<RankingEntry[]> {
  return isNewModelEnabled()
    ? getOrganicRankings(categorySlug, provinceSlug, limit)
    : getRankings(categorySlug, provinceSlug, limit);
}

/** Mismo punto único de decisión para "Cerca de mí". */
export async function getActiveNearbyRankings(
  lat: number,
  lon: number,
  categorySlug?: string,
  provinceSlug?: string,
  limit = 100,
): Promise<NearbyRankingEntry[]> {
  return isNewModelEnabled()
    ? getOrganicNearbyRankings(lat, lon, categorySlug, provinceSlug, limit)
    : getNearbyRankings(lat, lon, categorySlug, provinceSlug, limit);
}

/** Recalcula y guarda rating_avg/reviews_count/fast_response_rate/profile_completeness/
 *  rank_score de UN perfil — única fuente de verdad, usada tanto on-write (cada vez que se
 *  publica/oculta/borra una reseña o se edita el perfil) como por el barrido del cron y el
 *  backfill único (`scripts/recompute-rank-v2.ts`). */
export async function recomputeProfileRankFields(profileId: string): Promise<void> {
  const [prof] = await db
    .select({
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      tagline: profiles.tagline,
      whatsapp: profiles.whatsapp,
      instagramUrl: profiles.instagramUrl,
      websiteUrl: profiles.websiteUrl,
      address: profiles.address,
      latitude: profiles.latitude,
      longitude: profiles.longitude,
      subcategory: profiles.subcategory,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!prof) return;

  const [agg] = await db
    .select({
      ratingAvg: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
      reviewsCount: sql<number>`count(*)::int`,
      fastYes: sql<number>`count(*) filter (where ${reviews.fastResponse} = true)::int`,
      fastAnswered: sql<number>`count(*) filter (where ${reviews.fastResponse} is not null)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.profileId, profileId), eq(reviews.status, 'published')));

  const ratingAvg = Number(agg?.ratingAvg ?? 0);
  const reviewsCount = agg?.reviewsCount ?? 0;
  const fastResponseRate = agg?.fastAnswered ? Math.round((agg.fastYes / agg.fastAnswered) * 10000) / 100 : 0;
  const profileCompleteness = computeProfileCompleteness({
    ...prof,
    latitude: prof.latitude != null ? Number(prof.latitude) : null,
    longitude: prof.longitude != null ? Number(prof.longitude) : null,
  });
  const rankScore = computeRankScore({ ratingAvg, reviewsCount, profileCompleteness, fastResponseRate });

  await db
    .update(profiles)
    .set({
      ratingAvg: ratingAvg.toFixed(2),
      reviewsCount,
      fastResponseRate: fastResponseRate.toFixed(2),
      profileCompleteness,
      rankScore: rankScore.toFixed(2),
      rankScoreComputedAt: new Date(),
    })
    .where(eq(profiles.id, profileId));
}

/** Verifica una reseña si el autor tiene un contacto real (WhatsApp/ubicación/Instagram/web, NO
 *  solo una vista) con este negocio de al menos 1 hora de antigüedad — reutiliza `businessEvents`
 *  tal cual, sin tabla paralela de "visitas". No entra en `rank_score` todavía (ver comentario
 *  en el esquema): es informativa, para un sello "Reseña verificada" en una fase posterior. */
export async function markReviewVerifiedIfEligible(reviewId: string, profileId: string, userId: string): Promise<void> {
  const [contact] = await db
    .select({ id: businessEvents.id })
    .from(businessEvents)
    .where(
      and(
        eq(businessEvents.profileId, profileId),
        eq(businessEvents.userId, userId),
        or(
          eq(businessEvents.eventType, 'whatsapp_click'),
          eq(businessEvents.eventType, 'location_click'),
          eq(businessEvents.eventType, 'instagram_click'),
          eq(businessEvents.eventType, 'website_click'),
        ),
        lt(businessEvents.createdAt, sql`now() - interval '1 hour'`),
      ),
    )
    .limit(1);
  if (!contact) return;
  await db.update(reviews).set({ verified: true, verifiedAt: new Date() }).where(eq(reviews.id, reviewId));
}

const RECOMPUTE_BATCH_SIZE = 500;

/** Barrido diario (dentro del cron ya existente): red de seguridad para que ningún perfil se
 *  quede desactualizado — el recálculo on-write ya cubre el caso normal. No-op si el modelo
 *  nuevo no está activo. Por lotes (cursor `rank_score_computed_at`) para no tardar si hay
 *  miles de perfiles. */
export async function recomputeAllRankScores(): Promise<{ processed: number; skipped: boolean }> {
  if (!isNewModelEnabled()) return { processed: 0, skipped: true };

  const batch = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.isActive, true))
    .orderBy(sql`${profiles.rankScoreComputedAt} asc nulls first`)
    .limit(RECOMPUTE_BATCH_SIZE);

  for (const row of batch) {
    await recomputeProfileRankFields(row.id);
  }
  return { processed: batch.length, skipped: false };
}
