/**
 * Google Indexing API — avisa a Google al instante cuando una vacante se publica,
 * cambia de forma material o deja de estar disponible. Es el mecanismo que Google
 * recomienda EXPRESAMENTE para páginas con `JobPosting`.
 *
 * Credenciales: cuenta de servicio de Google Cloud con la Indexing API habilitada,
 * añadida como *propietario* del sitio en Search Console. Viven SOLO en el servidor:
 *   GOOGLE_INDEXING_CLIENT_EMAIL   = xxx@yyy.iam.gserviceaccount.com
 *   GOOGLE_INDEXING_PRIVATE_KEY    = -----BEGIN PRIVATE KEY-----\n...  (con \n escapados)
 *
 * Sin esas variables, todo aquí es un no-op silencioso (IndexNow sigue avisando a Bing).
 * Nunca bloquea la respuesta al usuario; los errores se guardan en `jobs.indexing_last_error`.
 */
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { jobs as J } from '../../shared/schema';
import { SITE_URL } from '../../shared/site';

export type IndexingType = 'URL_UPDATED' | 'URL_DELETED';

const ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';
/** Cuota diaria por defecto de la Indexing API. Dejamos margen. */
const DAILY_CAP = 180;

let warned = false;
function creds(): { email: string; key: string } | null {
  const email = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  const key = (process.env.GOOGLE_INDEXING_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) {
    if (!warned) {
      warned = true;
      console.info('[indexing] Google Indexing API sin credenciales — se omite (IndexNow sigue activo).');
    }
    return null;
  }
  return { email, key };
}

export const googleIndexingConfigured = () => creds() !== null;

let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string | null> {
  const c = creds();
  if (!c) return null;
  if (tokenCache && tokenCache.exp - 60 > Date.now() / 1000) return tokenCache.token;

  const { SignJWT, importPKCS8 } = await import('jose');
  const now = Math.floor(Date.now() / 1000);
  const pk = await importPKCS8(c.key, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(c.email)
    .setSubject(c.email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(pk);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

async function notifyOne(url: string, type: IndexingType): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const jobUrl = (slug: string) => `${SITE_URL}/empleo/${slug}`;

/**
 * Marca las vacantes indicadas como pendientes de notificar a Google y dispara un
 * flush en segundo plano. No espera al resultado (best-effort).
 */
export async function queueJobIndexing(slugs: string[], type: IndexingType): Promise<void> {
  const uniq = [...new Set(slugs)].filter(Boolean);
  if (!uniq.length) return;
  await db
    .update(J)
    .set({ indexingStatus: 'pending', indexingType: type, indexingRequestedAt: new Date() })
    .where(inArray(J.slug, uniq));
  void flushJobIndexing().catch(() => {});
}

/**
 * Notifica a Google las vacantes con `indexing_status IN ('pending','error')`,
 * priorizando las bajas (`URL_DELETED`) y respetando el tope diario.
 */
export async function flushJobIndexing(cap = DAILY_CAP): Promise<{ sent: number; failed: number }> {
  if (!googleIndexingConfigured()) return { sent: 0, failed: 0 };

  const pending = await db
    .select({ slug: J.slug, type: J.indexingType })
    .from(J)
    .where(
      or(
        eq(J.indexingStatus, 'pending'),
        and(eq(J.indexingStatus, 'error'), lt(J.indexingRequestedAt, sql`now() - interval '6 hours'`)),
      ),
    )
    .orderBy(sql`case when ${J.indexingType} = 'URL_DELETED' then 0 else 1 end`, J.indexingRequestedAt)
    .limit(cap);

  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    const type = (row.type as IndexingType) || 'URL_UPDATED';
    try {
      await notifyOne(jobUrl(row.slug), type);
      await db
        .update(J)
        .set({ indexingStatus: 'ok', indexingLastError: null, indexingRequestedAt: new Date() })
        .where(eq(J.slug, row.slug));
      sent++;
    } catch (e) {
      failed++;
      await db
        .update(J)
        .set({ indexingStatus: 'error', indexingLastError: String((e as Error).message).slice(0, 300) })
        .where(eq(J.slug, row.slug));
    }
  }
  return { sent, failed };
}
