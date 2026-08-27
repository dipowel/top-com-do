import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { categories } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';

const r = Router();

r.get(
  '/',
  ah(async (_req, res) => {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder));
    res.json(rows);
  }),
);

export default r;
