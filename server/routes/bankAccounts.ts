import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { bankAccounts } from '../../shared/schema';
import { ah } from '../lib/asyncHandler';

const r = Router();

r.get(
  '/',
  ah(async (_req, res) => {
    const rows = await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.isActive, true))
      .orderBy(asc(bankAccounts.sortOrder));
    res.json(rows);
  }),
);

export default r;
