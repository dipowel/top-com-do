import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../shared/schema';
import { adminAuth } from '../lib/firebaseAdmin';
import { HttpError } from './errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: 'user' | 'admin' | 'superadmin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function superadminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Verifica el token de Firebase (si existe) y sincroniza el usuario en Postgres. */
export async function loadUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const decoded = await adminAuth().verifyIdToken(token);
  const email = (decoded.email || '').toLowerCase();
  if (!email) throw new HttpError(401, 'El token no incluye un correo');

  const isSuper = superadminEmails().includes(email);

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
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { firebaseUid: decoded.uid, displayName: decoded.name ?? null, photoUrl: decoded.picture ?? null },
      })
      .returning();
    row = inserted[0]!;
  } else if (isSuper && row.role === 'user') {
    const updated = await db.update(users).set({ role: 'superadmin' }).where(eq(users.id, row.id)).returning();
    row = updated[0]!;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    role: row.role,
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  loadUser(req)
    .then((user) => {
      if (!user) throw new HttpError(401, 'Autenticación requerida');
      req.user = user;
      next();
    })
    .catch((e) => {
      if (e instanceof HttpError) return next(e);
      next(new HttpError(401, 'Token inválido o expirado'));
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
