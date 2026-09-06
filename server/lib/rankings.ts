import { and, eq, gt, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { bids, profiles, categories } from '../../shared/schema';
import { isRealProvince, provinceName } from '../../shared/provinces';
import { profileAvatarUrl } from '../../shared/site';
import { rankingWindowStart } from '../../shared/bidding';
import {
  NEARBY_BID_WEIGHT,
  NEARBY_PROXIMITY_WEIGHT,
  NEARBY_PROXIMITY_DECAY_KM,
  EARTH_RADIUS_KM,
} from '../../shared/nearby';
import type { RankingEntry, NearbyRankingEntry } from '../../shared/types';

/**
 * Ranking en vivo: suma de pujas VERIFICADAS por perfil dentro de la ventana móvil
 * (últimos RANKING_WINDOW_DAYS días). Sin reinicio semanal: el orden responde en
 * tiempo real a quién puja. Filtra por categoría y, opcionalmente, por provincia.
 */
export async function getRankings(
  categorySlug?: string,
  provinceSlug?: string,
  limit = 100,
): Promise<RankingEntry[]> {
  const since = rankingWindowStart();

  const total = sql<string>`coalesce(sum(${bids.amountDop}), 0)`;
  const count = sql<string>`count(${bids.id})`;

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
      totalDop: total,
      bidsCount: count,
    })
    .from(profiles)
    .innerJoin(categories, eq(categories.id, profiles.categoryId))
    .innerJoin(
      bids,
      and(
        eq(bids.profileId, profiles.id),
        eq(bids.status, 'verified'),
        gte(bids.verifiedAt, since),
      ),
    )
    .where(and(eq(profiles.isActive, true), filterCategory, filterProvince))
    .groupBy(profiles.id, categories.slug, categories.name)
    .having(gt(total, sql`0`))
    .orderBy(sql`${total} desc`)
    .limit(limit);

  return rows.map((r, i) => ({
    position: i + 1,
    isChampion: i === 0,
    totalDop: Number(r.totalDop),
    bidsCount: Number(r.bidsCount),
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
    },
  }));
}

/**
 * Modo "Cerca de mí": MISMO conjunto elegible que `getRankings` (negocios activos
 * con pujas verificadas en la ventana de 7 días, con los filtros de categoría y
 * provincia activos), re-ordenado por un score híbrido 70 % puja + 30 % proximidad.
 *
 * - Solo participan negocios con `latitude`/`longitude` no nulas.
 * - Sin filtro de radio: la distancia solo re-ordena, nunca excluye.
 * - Distancia por haversine en SQL (sin PostGIS). Score y orden también en SQL para
 *   que el `LIMIT` recorte las filas correctas. `shared/nearby.ts` es el espejo puro.
 * - Consulta parametrizada (el template `sql` parametriza cada interpolación).
 */
export async function getNearbyRankings(
  lat: number,
  lon: number,
  categorySlug?: string,
  provinceSlug?: string,
  limit = 100,
): Promise<NearbyRankingEntry[]> {
  const since = rankingWindowStart();
  const cat = categorySlug && categorySlug !== 'todo-rd' ? categorySlug : null;
  const prov = isRealProvince(provinceSlug) ? provinceSlug : null;

  const distKm = sql`
    ${EARTH_RADIUS_KM} * 2 * asin(least(1.0, sqrt(
      power(sin(radians((p.latitude::float8 - ${lat}) / 2)), 2)
      + cos(radians(${lat})) * cos(radians(p.latitude::float8))
        * power(sin(radians((p.longitude::float8 - ${lon}) / 2)), 2)
    )))`;

  const result = await db.execute(sql`
    WITH candidates AS (
      SELECT
        p.id, p.name, p.handle, p.avatar_url, p.bio, p.tagline, p.subcategory,
        p.whatsapp, p.instagram_url, p.website_url, p.province, p.city, p.address,
        p.latitude::float8 AS latitude, p.longitude::float8 AS longitude,
        c.slug AS category_slug, c.name AS category_name,
        sum(b.amount_dop)::float8 AS total_dop,
        count(b.id)::int AS bids_count,
        ${distKm} AS dist_km
      FROM profiles p
      JOIN categories c ON c.id = p.category_id
      JOIN bids b ON b.profile_id = p.id
                 AND b.status = 'verified'
                 AND b.verified_at >= ${since}
      WHERE p.is_active = true
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        ${cat ? sql`AND c.slug = ${cat}` : sql``}
        ${prov ? sql`AND p.province = ${prov}` : sql``}
      GROUP BY p.id, c.slug, c.name
      HAVING sum(b.amount_dop) > 0
    ),
    scored AS (
      SELECT *,
        ln(1 + total_dop) / greatest(ln(1 + max(total_dop) OVER ()), ln(2)) AS bid_score_n,
        exp(- dist_km / ${NEARBY_PROXIMITY_DECAY_KM}) AS prox_score_n
      FROM candidates
    )
    SELECT *,
      100 * (${NEARBY_BID_WEIGHT} * bid_score_n + ${NEARBY_PROXIMITY_WEIGHT} * prox_score_n) AS final_score
    FROM scored
    ORDER BY final_score DESC, total_dop DESC, dist_km ASC, id ASC
    LIMIT ${Math.min(Math.max(limit, 1), 250)}
  `);

  const rows = (result.rows ?? []) as Array<Record<string, unknown>>;
  const num = (v: unknown): number => Number(v ?? 0);

  return rows.map((r, i) => {
    const distanceKm = num(r.dist_km);
    return {
      position: i + 1,
      isChampion: i === 0,
      totalDop: num(r.total_dop),
      bidsCount: num(r.bids_count),
      distanceKm,
      distanceMeters: Math.round(distanceKm * 1000),
      bidScore: Math.min(100, num(r.bid_score_n) * 100),
      proximityScore: num(r.prox_score_n) * 100,
      finalScore: num(r.final_score),
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
      },
    };
  });
}
