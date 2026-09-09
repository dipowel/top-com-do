/**
 * Utilidades de `job_sources`. La lógica de ingesta vive en `server/lib/jobImport.ts`
 * y los adaptadores en `server/adapters/`.
 *
 * Fuentes hoy:
 *  - `direct`  → publicación de empresas (entra por `POST /api/jobs`, no por fetch).
 *  - `greenhouse` / `lever` / `csv` → operables por fuente, con config y autorización.
 *  - `jooble` → requiere `JOOBLE_API_KEY` + autorización.
 *  - `linkedin` / `computrabajo` / `tecoloco` / `tunuevotrabajo` → esqueletos: lanzan
 *    `SourceNotAuthorizedError` (su ToS/robots.txt prohíben la extracción).
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { jobSources } from '../../shared/schema';

/** Garantiza que exista la fila de la fuente "direct" (idempotente). */
export async function ensureDirectSource(): Promise<string> {
  const [existing] = await db
    .select({ id: jobSources.id })
    .from(jobSources)
    .where(eq(jobSources.platform, 'direct'))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(jobSources)
    .values({
      name: 'Publicación directa',
      platform: 'direct',
      sourceType: 'direct',
      authorizationStatus: 'authorized',
      isEnabled: true,
      autoPublish: true,
    })
    .onConflictDoNothing({ target: jobSources.platform })
    .returning({ id: jobSources.id });
  if (row) return row.id;
  const [again] = await db
    .select({ id: jobSources.id })
    .from(jobSources)
    .where(eq(jobSources.platform, 'direct'))
    .limit(1);
  return again!.id;
}

export { runDueSources as runEnabledSources } from './jobImport';
