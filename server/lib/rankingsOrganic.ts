import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { profiles, categories } from '../../shared/schema';
import { isRealProvince, provinceName } from '../../shared/provinces';
import { profileAvatarUrl } from '../../shared/site';
import type { RankingEntry } from '../../shared/types';

/**
 * Ranking v2 (orgánico): orden 100% por `rank_score` (reseñas, perfil completo, rapidez —
 * ver `shared/rankScore.ts`), en vivo, sin ninguna posición cacheada. Es el paralelo de
 * `getRankings()` (pujas) — esa función queda intacta, esta es nueva y aparte. Cuál de las dos
 * se usa lo decide `getActiveRankings()` en `rankingModel.ts` según `NEW_MODEL_ENABLED`.
 *
 * `totalDop`/`bidsCount` del DTO `RankingEntry` se reutilizan con otro significado bajo este
 * modelo (mismo patrón que `rank_leaders.leader_total_dop`): `totalDop` = `rank_score` (0-100),
 * `bidsCount` = `reviewsCount`. Mismo shape exacto que el modelo de pujas — cero cambios de tipo
 * en el cliente para poder convivir detrás del flag.
 *
 * Solo entran negocios con al menos 1 reseña publicada — igual que hoy el modelo de pujas exige
 * `totalDop > 0` para aparecer (nadie entra al ranking público sin ninguna señal real).
 */
export async function getOrganicRankings(
  categorySlug?: string,
  provinceSlug?: string,
  limit = 100,
): Promise<RankingEntry[]> {
  const filterCategory =
    categorySlug && categorySlug !== 'todo-rd' ? eq(categories.slug, categorySlug) : undefined;
  const filterProvince = isRealProvince(provinceSlug) ? eq(profiles.province, provinceSlug) : undefined;

  const rows = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      handle: profiles.handle,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      tagline: profiles.tagline,
      subcategory: profiles.subcategory,
      whatsapp: profiles.whatsapp,
      instagramUrl: profiles.instagramUrl,
      websiteUrl: profiles.websiteUrl,
      province: profiles.province,
      city: profiles.city,
      address: profiles.address,
      latitude: profiles.latitude,
      longitude: profiles.longitude,
      categorySlug: categories.slug,
      categoryName: categories.name,
      founderNumber: profiles.founderNumber,
      rankScore: profiles.rankScore,
      reviewsCount: profiles.reviewsCount,
    })
    .from(profiles)
    .innerJoin(categories, eq(categories.id, profiles.categoryId))
    .where(and(eq(profiles.isActive, true), gt(profiles.reviewsCount, 0), filterCategory, filterProvince))
    .orderBy(desc(profiles.rankScore))
    .limit(limit);

  return rows.map((r, i) => ({
    position: i + 1,
    isChampion: i === 0,
    totalDop: Number(r.rankScore),
    bidsCount: r.reviewsCount,
    profile: {
      id: r.id,
      name: r.name,
      handle: r.handle,
      avatarUrl: profileAvatarUrl(r.id, r.avatarUrl),
      bio: r.bio,
      tagline: r.tagline,
      subcategory: r.subcategory,
      whatsapp: r.whatsapp,
      instagramUrl: r.instagramUrl,
      websiteUrl: r.websiteUrl,
      province: r.province,
      provinceName: r.province ? provinceName(r.province) : null,
      city: r.city,
      address: r.address,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      categorySlug: r.categorySlug,
      categoryName: r.categoryName,
      founderNumber: r.founderNumber,
    },
  }));
}
