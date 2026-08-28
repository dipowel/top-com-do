import { Router } from 'express';
import { ah } from '../lib/asyncHandler';
import { getRankings } from '../lib/rankings';

const r = Router();

r.get(
  '/',
  ah(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const province = typeof req.query.province === 'string' ? req.query.province : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const data = await getRankings(category, province, limit);
    res.json(data);
  }),
);

export default r;
