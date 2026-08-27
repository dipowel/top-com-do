import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { profiles, categories, bids, users } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { audit } from '../lib/audit';

const r = Router();

r.get(
  '/',
  ah(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        handle: profiles.handle,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        whatsapp: profiles.whatsapp,
        city: profiles.city,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(
        and(
          eq(profiles.isActive, true),
          category && category !== 'todo-rd' ? eq(categories.slug, category) : undefined,
        ),
      )
      .orderBy(desc(profiles.createdAt));
    res.json(rows);
  }),
);

const createSchema = z.object({
  name: z.string().min(2).max(80),
  handle: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_.-]+$/i, 'Solo letras, números, punto, guion y guion bajo'),
  categorySlug: z.string().min(1),
  bio: z.string().max(400).optional(),
  whatsapp: z.string().max(30).optional(),
  city: z.string().max(60).optional(),
  avatarUrl: z.string().url().optional(),
});

r.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = createSchema.parse(req.body);
    const cat = await db.select().from(categories).where(eq(categories.slug, body.categorySlug)).limit(1);
    if (!cat[0]) throw new HttpError(400, 'Categoría inválida');

    const exists = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.handle, body.handle.toLowerCase())).limit(1);
    if (exists[0]) throw new HttpError(409, 'Ese handle ya está en uso');

    const inserted = await db
      .insert(profiles)
      .values({
        name: body.name,
        handle: body.handle.toLowerCase(),
        categoryId: cat[0].id,
        bio: body.bio,
        whatsapp: body.whatsapp,
        city: body.city,
        avatarUrl: body.avatarUrl,
        ownerUserId: req.user!.id,
      })
      .returning();

    await audit(req.user!.id, 'profile.create', 'profile', inserted[0]!.id, { handle: body.handle });
    res.status(201).json(inserted[0]);
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        handle: profiles.handle,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        whatsapp: profiles.whatsapp,
        city: profiles.city,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(profiles)
      .innerJoin(categories, eq(categories.id, profiles.categoryId))
      .where(eq(profiles.id, req.params.id))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, 'Perfil no encontrado');
    res.json(rows[0]);
  }),
);

r.get(
  '/:id/bids',
  ah(async (req, res) => {
    const rows = await db
      .select({
        id: bids.id,
        amountDop: bids.amountDop,
        method: bids.method,
        createdAt: bids.createdAt,
        verifiedAt: bids.verifiedAt,
        bidderName: users.displayName,
      })
      .from(bids)
      .leftJoin(users, eq(users.id, bids.userId))
      .where(and(eq(bids.profileId, req.params.id), eq(bids.status, 'verified')))
      .orderBy(desc(bids.verifiedAt));
    res.json(rows.map((x) => ({ ...x, amountDop: Number(x.amountDop) })));
  }),
);

export default r;
