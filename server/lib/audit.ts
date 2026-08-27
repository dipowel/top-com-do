import { db } from '../db';
import { auditLog } from '../../shared/schema';

export async function audit(
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  meta?: unknown,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: actorUserId ?? undefined,
      action,
      entity,
      entityId: entityId ?? undefined,
      meta: meta ?? undefined,
    });
  } catch (e) {
    console.error('[audit] no se pudo registrar', action, e);
  }
}
