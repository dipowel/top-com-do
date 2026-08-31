import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users, profiles, categories, rankLeaders } from '../../shared/schema';
import { getRankings } from './rankings';
import { minNextBidForProfile } from './auction';
import { sendEmail, dethroneEmailHtml } from './email';
import { NATIONAL_SLUG, provinceName } from '../../shared/provinces';
import { formatDOP } from '../../shared/fx';

interface NewNotification {
  type: string;
  title: string;
  body: string;
  url?: string;
  meta?: unknown;
}

export async function notifyUser(userId: string, n: NewNotification): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      meta: n.meta ?? undefined,
    });
  } catch (e) {
    console.error('[notify] usuario', e);
  }
}

export async function notifyAdmins(n: NewNotification): Promise<void> {
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'superadmin')));
    if (!admins.length) return;
    await db.insert(notifications).values(
      admins.map((a) => ({
        userId: a.id,
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url,
        meta: n.meta ?? undefined,
      })),
    );
  } catch (e) {
    console.error('[notify] admins', e);
  }
}

/**
 * Tras verificar una puja: recalcula el #1 de los ámbitos afectados
 * (categoría a nivel nacional y a nivel de la provincia del perfil) y, si el
 * líder cambió, notifica al negocio destronado.
 */
export async function checkDethronements(bidProfileId: string): Promise<void> {
  const prof = (
    await db
      .select({
        id: profiles.id,
        name: profiles.name,
        province: profiles.province,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.id, bidProfileId))
      .limit(1)
  )[0];
  if (!prof) return;

  const scopes: Array<{ province?: string; label: string }> = [
    { province: undefined, label: `${prof.categoryName} · Todo RD` },
  ];
  if (prof.province && prof.province !== NATIONAL_SLUG) {
    scopes.push({
      province: prof.province,
      label: `${prof.categoryName} · ${provinceName(prof.province)}`,
    });
  }

  for (const s of scopes) {
    const scopeKey = `${prof.categorySlug}:${s.province ?? 'national'}`;
    const ranking = await getRankings(prof.categorySlug, s.province, 1);
    const newLeader = ranking[0];
    if (!newLeader) continue;

    const prev = (
      await db.select().from(rankLeaders).where(eq(rankLeaders.scopeKey, scopeKey)).limit(1)
    )[0];

    // ¿Cambió el líder? El anterior queda en #2 → notificarlo (in-app + correo).
    if (prev?.leaderProfileId && prev.leaderProfileId !== newLeader.profile.id) {
      const dethroned = (
        await db
          .select({
            id: profiles.id,
            ownerUserId: profiles.ownerUserId,
            name: profiles.name,
            ownerEmail: users.email,
          })
          .from(profiles)
          .leftJoin(users, eq(users.id, profiles.ownerUserId))
          .where(and(eq(profiles.id, prev.leaderProfileId), eq(profiles.isActive, true)))
          .limit(1)
      )[0];
      if (dethroned?.ownerUserId) {
        let minBidDop = newLeader.totalDop + 100;
        try {
          minBidDop = (await minNextBidForProfile(dethroned.id)).minBidDop;
        } catch {
          /* usa el estimado */
        }

        await notifyUser(dethroned.ownerUserId, {
          type: 'rank.dethroned',
          title: `⚠️ Te superaron en ${s.label}`,
          body: `Ahora estás #2. El nuevo #1 (${newLeader.profile.name}) está en ${formatDOP(newLeader.totalDop)}. Recupera el #1 con ${formatDOP(minBidDop)}.`,
          url: `/p/${dethroned.id}?pujar=1`,
          meta: {
            profileId: dethroned.id,
            categorySlug: prof.categorySlug,
            province: s.province ?? NATIONAL_SLUG,
            newLeaderTotal: newLeader.totalDop,
            minBidDop,
          },
        });

        if (dethroned.ownerEmail) {
          try {
            await sendEmail({
              to: dethroned.ownerEmail,
              subject: `⚠️ Te superaron en ${s.label} — recupera tu #1`,
              html: dethroneEmailHtml({
                businessName: dethroned.name,
                scopeLabel: s.label,
                newLeaderName: newLeader.profile.name,
                newLeaderTotalDop: newLeader.totalDop,
                minBidDop,
                profileId: dethroned.id,
              }),
            });
          } catch (e) {
            console.error('[notify] correo destronamiento falló:', (e as Error).message);
          }
        }
      }
    }

    await db
      .insert(rankLeaders)
      .values({
        scopeKey,
        leaderProfileId: newLeader.profile.id,
        leaderTotalDop: newLeader.totalDop.toFixed(2),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: rankLeaders.scopeKey,
        set: {
          leaderProfileId: newLeader.profile.id,
          leaderTotalDop: newLeader.totalDop.toFixed(2),
          updatedAt: new Date(),
        },
      });
  }
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<string>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`));
  return Number(rows[0]?.n ?? 0);
}

export async function markRead(userId: string, ids?: string[]): Promise<void> {
  const where = ids?.length
    ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
    : and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`);
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}
