import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import express from 'express';
import cors from 'cors';
import { eq } from 'drizzle-orm';

import { noStore } from './middleware/noStore';
import { errorHandler } from './middleware/errorHandler';
import { ah } from './lib/asyncHandler';
import { db } from './db';
import { profiles as profilesTable } from '../shared/schema';
import { sitemapUrls, renderSitemap } from '../shared/seo';
import { renderPage } from './lib/renderPage';

import health from './routes/health';
import categories from './routes/categories';
import rankings from './routes/rankings';
import profiles from './routes/profiles';
import bids from './routes/bids';
import checkout from './routes/checkout';
import webhooks from './routes/webhooks';
import me from './routes/me';
import admin from './routes/admin';
import cron from './routes/cron';
import reviews from './routes/reviews';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: [
        /^https:\/\/([a-z0-9-]+\.)?top\.com\.do$/,
        /^http:\/\/localhost:\d+$/,
        /\.vercel\.app$/,
      ],
    }),
  );

  // Webhooks: ANTES del parser JSON global — necesitan el cuerpo crudo para la firma.
  app.use('/api/webhooks', webhooks);

  // En Vercel el body JSON puede venir ya parseado. Evita doble lectura del stream.
  const jsonParser = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) return next();
    jsonParser(req, res, next);
  });

  // SEO: sitemap dinámico (fuera de /api; `noStore` no aplica, así que se puede cachear).
  app.get(
    '/sitemap.xml',
    ah(async (_req, res) => {
      const rows = await db
        .select({ id: profilesTable.id, createdAt: profilesTable.createdAt })
        .from(profilesTable)
        .where(eq(profilesTable.isActive, true));
      res.type('application/xml');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.send(renderSitemap(sitemapUrls(rows)));
    }),
  );

  app.use('/api', noStore);

  app.use('/api', health);
  app.use('/api/categories', categories);
  app.use('/api/rankings', rankings);
  app.use('/api/profiles', profiles);
  app.use('/api/bids', bids);
  app.use('/api/checkout', checkout);
  app.use('/api/me', me);
  app.use('/api/reviews', reviews);
  app.use('/api/admin', admin);
  app.use('/api/cron', cron);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Assets estáticos (en Vercel los sirve el CDN antes de llegar aquí; útil en `npm start`).
  const clientDist = resolvePath(process.cwd(), 'client/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1y', immutable: true }));
  }

  // SEO: cada ruta HTML recibe su <title>/meta/canónico/JSON-LD/<h1> renderizados.
  app.get(
    '*',
    ah(async (req, res) => {
      const { html, status, cacheSeconds } = await renderPage(req.path);
      res.status(status);
      res.type('html');
      const cc =
        status === 200
          ? `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
          : 'public, max-age=0, s-maxage=60';
      res.setHeader('Cache-Control', cc);
      res.setHeader('CDN-Cache-Control', cc);
      res.send(html);
    }),
  );

  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
