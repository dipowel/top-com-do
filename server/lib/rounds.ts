import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { rounds } from '../../shared/schema';
import type { Round } from '../../shared/schema';

/** Lunes 00:00 UTC de la semana de `d`. */
function startOfWeek(d = new Date()): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 = domingo
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date;
}

export async function createRound(resetByUserId: string | null): Promise<Round> {
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const inserted = await db
    .insert(rounds)
    .values({
      weekStart,
      weekEnd,
      isActive: true,
      resetByUserId: resetByUserId ?? undefined,
    })
    .returning();
  return inserted[0]!;
}

export async function getActiveRound(): Promise<Round> {
  const rows = await db
    .select()
    .from(rounds)
    .where(eq(rounds.isActive, true))
    .orderBy(desc(rounds.createdAt))
    .limit(1);
  if (rows[0]) return rows[0];
  return createRound(null);
}

/** Cierra la ronda activa y abre una nueva desde cero (puesto #1). */
export async function resetRound(resetByUserId: string | null): Promise<Round> {
  await db.update(rounds).set({ isActive: false }).where(eq(rounds.isActive, true));
  return createRound(resetByUserId);
}
