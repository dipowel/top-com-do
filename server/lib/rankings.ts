import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import { bids, profiles, categories } from '../../shared/schema';
import { getActiveRound } from './rounds';
import type { RankingEntry } from '../../shared/types';

/**
 * Ranking en vivo: suma de pujas VERIFICADAS por perfil en la ronda activa,
 * filtrando solo perfiles con puja activa > 0 DOP.
 */
export async function getRankings(categorySlug?: string, limit = 100): Promise<RankingEntry[]> {
  const round = await getActiveRound();

  const total = sql<string>`coalesce(sum(${bids.amountDop}), 0)`;
  const count = sql<string>`count(${bids.id})`;

  const filterCategory =
    categorySlug && categorySlug !== 'todo-rd' ? eq(categories.slug, categorySlug) : undefined;

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
        eq(bids.roundId, round.id),
        eq(bids.status, 'verified'),
      ),
    )
    .where(and(eq(profiles.isActive, true), filterCategory))
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
      avatarUrl: r.avatarUrl,
      bio: r.bio,
      tagline: r.tagline,
      subcategory: r.subcategory,
      whatsapp: r.whatsapp,
      instagramUrl: r.instagramUrl,
      websiteUrl: r.websiteUrl,
      city: r.city,
      address: r.address,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      categorySlug: r.categorySlug,
      categoryName: r.categoryName,
    },
  }));
}
