import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { bids, profiles, categories } from '../../shared/schema';
import { getActiveRound } from './rounds';
import { getRankings } from './rankings';
import { minNextBid } from '../../shared/bidding';

export interface AuctionState {
  leaderTotalDop: number;
  myTotalDop: number;
  iAmLeader: boolean;
  minBidDop: number;
}

/**
 * Estado de la subasta para un perfil: cuánto lleva el #1 de su categoría ×
 * provincia, cuánto lleva él, y la oferta mínima para superarlo.
 */
export async function minNextBidForProfile(profileId: string): Promise<AuctionState> {
  const prof = (
    await db
      .select({ categorySlug: categories.slug, province: profiles.province })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.id, profileId))
      .limit(1)
  )[0];
  if (!prof) throw new Error('Perfil no encontrado');

  const round = await getActiveRound();
  const mine = await db
    .select({ total: sql<string>`coalesce(sum(${bids.amountDop}), 0)` })
    .from(bids)
    .where(
      and(eq(bids.profileId, profileId), eq(bids.roundId, round.id), eq(bids.status, 'verified')),
    );
  const myTotalDop = Number(mine[0]?.total ?? 0);

  const ranking = await getRankings(prof.categorySlug, prof.province ?? undefined, 1);
  const leader = ranking[0];
  const leaderTotalDop = leader?.totalDop ?? 0;
  const iAmLeader = Boolean(leader && leader.profile.id === profileId);

  return {
    leaderTotalDop,
    myTotalDop,
    iAmLeader,
    minBidDop: minNextBid({ leaderTotalDop, myTotalDop, iAmLeader }),
  };
}
