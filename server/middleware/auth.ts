import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../shared/schema';
import { verifyIdToken } from '../lib/firebaseAuth';
import { generateReferralCode } from '../lib/rewards';
import { HttpError } from './errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: 'user' | 'admin' | 'superadmin';
  referralCode: string | null;
  creditBalanceDop: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Fallback: estos correos son superadmin aunque SUPERADMIN_EMAILS no esté bien
// configurada en el entorno. SUPERADMIN_EMAILS (coma-separado) los amplía.
const HARDCODED_SUPERADMINS = ['dpowelsantana15@gmail.com', 'dipowelsantana15@gmail.com'];

function superadminEmails(): Set<string> {
  const fromEnv = (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...HARDCODED_SUPERADMINS, ...fromEnv]);
}

/** Verifica el token de Firebase (si existe) y sincroniza el usuario en Postgres. */
export async function loadUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const decoded = await verifyIdToken(token);
  const email = (decoded.email || '').toLowerCase();
  if (!email) throw new HttpError(401, 'El token no incluye un correo');

  const isSuper = superadminEmails().has(email);

  const found = await db.select().from(users).where(eq(users.firebaseUid, decoded.uid)).limit(1);
  let row = found[0];

  if (!row) {
    const inserted = await db
      .insert(users)
      .values({
        firebaseUid: decoded.uid,
        email,
        displayName: decoded.name ?? null,
        photoUrl: decoded.picture ?? null,
        role: isSuper ? 'superadmin' : 'user',
        referralCode: generateReferralCode(email),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firebaseUid: decoded.uid,
          displayName: decoded.name ?? null,
          photoUrl: decoded.picture ?? null,
          ...(isSuper ? { role: 'superadmin' as const } : {}),
        },
      })
      .returning();
    row = inserted[0]!;
  } else if (isSuper && row.role !== 'superadmin') {
    const updated = await db.update(users).set({ role: 'superadmin' }).where(eq(users.id, row.id)).returning();
    row = updated[0]!;
  }

  // Usuarios antiguos sin código de referido
  if (!row.referralCode) {
    const updated = await db
      .update(users)
      .set({ referralCode: generateReferralCode(row.email) })
      .where(eq(users.id, row.id))
      .returning();
    row = updated[0]!;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    role: row.role,
    referralCode: row.referralCode,
    creditBalanceDop: Number(row.creditBalanceDop),
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  loadUser(req)
    .then((user) => {
      if (!user) return next(new HttpError(401, 'Autenticación requerida'));
      req.user = user;
      next();
    })
    .catch((e) => {
      if (e instanceof HttpError) return next(e);
      console.error('[auth] loadUser falló:', e);
      const msg = String((e as Error)?.message || e);
      if (/jwt|jwk|signature|aud|audience|iss|issuer|token|expired|exp/i.test(msg)) {
        return next(new HttpError(401, `Token rechazado: ${msg}`));
      }
      return next(new HttpError(500, 'Error verificando la sesión'));
    });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
      return next(new HttpError(403, 'Acceso solo para administradores'));
    }
    next();
  });
}
