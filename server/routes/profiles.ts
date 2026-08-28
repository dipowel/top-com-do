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

const profileColumns = {
  id: profiles.id,
  name: profiles.name,
  handle: profiles.handle,
  avatarUrl: profiles.avatarUrl,
  bio: profiles.bio,
  tagline: profiles.tagline,
  whatsapp: profiles.whatsapp,
  instagramUrl: profiles.instagramUrl,
  websiteUrl: profiles.websiteUrl,
  city: profiles.city,
  categorySlug: categories.slug,
  categoryName: categories.name,
};

r.get(
  '/',
  ah(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const rows = await db
      .select(profileColumns)
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

const imageValue = z
  .string()
  .max(220_000)
  .refine((v) => /^https?:\/\//.test(v) || /^data:image\//.test(v), 'Imagen inválida');

const linkValue = z
  .string()
  .max(300)
  .refine((v) => /^https?:\/\//.test(v) || /^\+?[\d\s()-]{6,}$/.test(v), 'Enlace inválido');

const createSchema = z.object({
  name: z.string().min(2).max(80),
  handle: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_.-]+$/i, 'Solo letras, números, punto, guion y guion bajo')
    .optional(),
  categorySlug: z.string().min(1),
  tagline: z.string().max(60).optional(),
  bio: z.string().max(400).optional(),
  whatsapp: z.string().max(30).optional(),
  instagramUrl: linkValue.optional(),
  websiteUrl: linkValue.optional(),
  city: z.string().max(60).optional(),
  avatarUrl: imageValue.optional(),
});

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 34);
  return base || 'perfil';
}

r.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = createSchema.parse(req.body);

    const cat = await db.select().from(categories).where(eq(categories.slug, body.categorySlug)).limit(1);
    if (!cat[0]) throw new HttpError(400, 'Categoría inválida');

    // handle: usa el dado, o genera uno único a partir del nombre
    let handle = (body.handle || slugify(body.name)).toLowerCase();
    for (let i = 0; i < 50; i++) {
      const taken = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.handle, handle)).limit(1);
      if (!taken[0]) break;
      if (body.handle) throw new HttpError(409, 'Ese handle ya está en uso');
      handle = `${slugify(body.name)}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const inserted = await db
      .insert(profiles)
      .values({
        name: body.name,
        handle,
        categoryId: cat[0].id,
        tagline: body.tagline,
        bio: body.bio ?? body.tagline,
        whatsapp: body.whatsapp,
        instagramUrl: body.instagramUrl,
        websiteUrl: body.websiteUrl,
        city: body.city,
        avatarUrl: body.avatarUrl,
        ownerUserId: req.user!.id,
      })
      .returning();

    await audit(req.user!.id, 'profile.create', 'profile', inserted[0]!.id, { handle, name: body.name });
    res.status(201).json(inserted[0]);
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    const rows = await db
      .select(profileColumns)
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
