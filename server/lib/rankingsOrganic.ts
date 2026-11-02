import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import { profiles, categories } from '../../shared/schema';
import { isRealProvince, provinceName } from '../../shared/provinces';
import { profileAvatarUrl } from '../../shared/site';
import { EARTH_RADIUS_KM } from '../../shared/nearby';
import type { RankingEntry, NearbyRankingEntry } from '../../shared/types';

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
      ratingAvg: profiles.ratingAvg,
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
    ratingAvg: Number(r.ratingAvg),
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

/**
 * Modo "Cerca de mí" bajo el ranking v2: mismo conjunto elegible que `getOrganicRankings`
 * (negocios activos con al menos 1 reseña), pero re-ordenado 100% por distancia — sin ningún
 * componente de puja (a diferencia de `getNearbyRankings()`, que mezcla puja + proximidad).
 * Reseñas no tiene (todavía) una señal de "cercanía ponderada"; ordenar solo por distancia es
 * honesto y simple mientras no exista esa fase.
 */
export async function getOrganicNearbyRankings(
  lat: number,
  lon: number,
  categorySlug?: string,
  provinceSlug?: string,
  limit = 100,
): Promise<NearbyRankingEntry[]> {
  const cat = categorySlug && categorySlug !== 'todo-rd' ? categorySlug : null;
  const prov = isRealProvince(provinceSlug) ? provinceSlug : null;

  const distKm = sql`
    ${EARTH_RADIUS_KM} * 2 * asin(least(1.0, sqrt(
      power(sin(radians((p.latitude::float8 - ${lat}) / 2)), 2)
      + cos(radians(${lat})) * cos(radians(p.latitude::float8))
        * power(sin(radians((p.longitude::float8 - ${lon}) / 2)), 2)
    )))`;

  const result = await db.execute(sql`
    SELECT
      p.id, p.name, p.handle, p.avatar_url, p.bio, p.tagline, p.subcategory,
      p.whatsapp, p.instagram_url, p.website_url, p.province, p.city, p.address,
      p.latitude::float8 AS latitude, p.longitude::float8 AS longitude,
      c.slug AS category_slug, c.name AS category_name, p.founder_number,
      p.rank_score::float8 AS rank_score, p.reviews_count, p.rating_avg::float8 AS rating_avg,
      ${distKm} AS dist_km
    FROM profiles p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = true
      AND p.reviews_count > 0
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      ${cat ? sql`AND c.slug = ${cat}` : sql``}
      ${prov ? sql`AND p.province = ${prov}` : sql``}
    ORDER BY dist_km ASC
    LIMIT ${Math.min(Math.max(limit, 1), 250)}
  `);

  const rows = (result.rows ?? []) as Array<Record<string, unknown>>;
  const num = (v: unknown): number => Number(v ?? 0);

  return rows.map((r, i) => {
    const distanceKm = num(r.dist_km);
    return {
      position: i + 1,
      isChampion: i === 0,
      totalDop: num(r.rank_score),
      bidsCount: num(r.reviews_count),
      ratingAvg: num(r.rating_avg),
      distanceKm,
      distanceMeters: Math.round(distanceKm * 1000),
      bidScore: 0,
      proximityScore: 100,
      finalScore: 100,
      profile: {
        id: String(r.id),
        name: String(r.name),
        handle: String(r.handle),
        avatarUrl: profileAvatarUrl(String(r.id), (r.avatar_url as string | null) ?? null),
        bio: (r.bio as string | null) ?? null,
        tagline: (r.tagline as string | null) ?? null,
        subcategory: (r.subcategory as string | null) ?? null,
        whatsapp: (r.whatsapp as string | null) ?? null,
        instagramUrl: (r.instagram_url as string | null) ?? null,
        websiteUrl: (r.website_url as string | null) ?? null,
        province: (r.province as string | null) ?? null,
        provinceName: r.province ? provinceName(String(r.province)) : null,
        city: (r.city as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        categorySlug: String(r.category_slug),
        categoryName: String(r.category_name),
        founderNumber: r.founder_number != null ? Number(r.founder_number) : null,
      },
    };
  });
}
