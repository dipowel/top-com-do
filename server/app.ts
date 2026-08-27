import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { noStore } from './middleware/noStore';
import { errorHandler } from './middleware/errorHandler';

import health from './routes/health';
import categories from './routes/categories';
import rankings from './routes/rankings';
import profiles from './routes/profiles';
import bankAccounts from './routes/bankAccounts';
import bids from './routes/bids';
import uploads from './routes/uploads';
import payments from './routes/payments';
import me from './routes/me';
import admin from './routes/admin';
import cron from './routes/cron';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors());

  // En Vercel el body JSON puede venir ya parseado. Evita doble lectura del stream.
  const jsonParser = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) return next();
    jsonParser(req, res, next);
  });

  app.use('/api', noStore);

  app.use('/api', health);
  app.use('/api/categories', categories);
  app.use('/api/rankings', rankings);
  app.use('/api/profiles', profiles);
  app.use('/api/bank-accounts', bankAccounts);
  app.use('/api/bids', bids);
  app.use('/api/uploads', uploads);
  app.use('/api/payments', payments);
  app.use('/api/me', me);
  app.use('/api/admin', admin);
  app.use('/api/cron', cron);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
