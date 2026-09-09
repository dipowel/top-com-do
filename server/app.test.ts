import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app';

describe('API base', () => {
  it('GET /api/health responde ok con cabecera no-store', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('GET /api/rankings responde JSON (200) o error controlado sin DB (500)', async () => {
    const res = await request(app).get('/api/rankings');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/rankings/nearby sin coordenadas → 400', async () => {
    const res = await request(app).get('/api/rankings/nearby');
    expect(res.status).toBe(400);
  });

  it('GET /api/rankings/nearby con coordenadas fuera de rango → 400', async () => {
    const res = await request(app).get('/api/rankings/nearby?lat=91&lon=0');
    expect(res.status).toBe(400);
  });

  it('GET /api/rankings/nearby con coordenadas válidas → JSON (200) o 500 sin DB; no-store', async () => {
    const res = await request(app).get('/api/rankings/nearby?lat=18.48&lon=-69.93');
    expect([200, 500]).toContain(res.status);
    expect(res.headers['cache-control']).toContain('no-store');
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
      for (const e of res.body) {
        expect(typeof e.distanceKm).toBe('number');
        expect(e.distanceKm).toBeGreaterThanOrEqual(0);
        expect(e.finalScore).toBeGreaterThanOrEqual(0);
        expect(e.finalScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('POST /api/bids sin token → 401', async () => {
    const res = await request(app).post('/api/bids').send({ profileId: 'x', method: 'credit', amount: 10 });
    expect(res.status).toBe(401);
  });

  it('POST /api/checkout/dodo sin token → 401', async () => {
    const res = await request(app).post('/api/checkout/dodo').send({ profileId: 'x', amountDop: 500 });
    expect(res.status).toBe(401);
  });

  it('POST /api/webhooks/dodo sin firma → 401', async () => {
    const res = await request(app).post('/api/webhooks/dodo').send({ type: 'payment.succeeded' });
    expect(res.status).toBe(401);
  });

  it('GET /api/webhooks/dodo → 200 (ping de verificación)', async () => {
    const res = await request(app).get('/api/webhooks/dodo');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/checkout/dodo/reconcile sin token → 401', async () => {
    const res = await request(app).post('/api/checkout/dodo/reconcile');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/overview sin token → 401', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/profiles sin token → 401', async () => {
    const res = await request(app).get('/api/admin/profiles');
    expect(res.status).toBe(401);
  });

  it('GET /api/me/bids/:id (comprobante) sin token → 401', async () => {
    const res = await request(app).get('/api/me/bids/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('GET /api/profiles/:id/avatar responde (404 sin logo / 500 sin DB), nunca cuelga', async () => {
    const res = await request(app).get('/api/profiles/00000000-0000-0000-0000-000000000000/avatar');
    expect([404, 500]).toContain(res.status);
  });

  it('ruta desconocida bajo /api → 404 JSON', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('GET /api/jobs responde JSON (200) o error controlado sin DB (500); no-store', async () => {
    const res = await request(app).get('/api/jobs');
    expect([200, 500]).toContain(res.status);
    expect(res.headers['cache-control']).toContain('no-store');
    if (res.status === 200) expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/jobs/facets → [200, 500]', async () => {
    const res = await request(app).get('/api/jobs/facets');
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/jobs/:slug inexistente → [404, 500]', async () => {
    const res = await request(app).get('/api/jobs/vacante-que-no-existe');
    expect([404, 500]).toContain(res.status);
  });

  it('POST /api/jobs sin token → 401', async () => {
    const res = await request(app).post('/api/jobs').send({ title: 'x', description: 'y' });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/jobs/:id sin token → 401', async () => {
    const res = await request(app).patch('/api/jobs/00000000-0000-0000-0000-000000000000').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /api/jobs/:id/report sin token → 401', async () => {
    const res = await request(app).post('/api/jobs/00000000-0000-0000-0000-000000000000/report').send({ reason: 'spam' });
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/jobs sin token → 401', async () => {
    const res = await request(app).get('/api/admin/jobs');
    expect(res.status).toBe(401);
  });

  it('GET /api/me/jobs sin token → 401', async () => {
    const res = await request(app).get('/api/me/jobs');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/job-sources y /job-import-runs sin token → 401', async () => {
    expect((await request(app).get('/api/admin/job-sources')).status).toBe(401);
    expect((await request(app).get('/api/admin/job-import-runs')).status).toBe(401);
  });

  it('POST /api/admin/jobs/:id/approve sin token → 401', async () => {
    const res = await request(app).post('/api/admin/jobs/00000000-0000-0000-0000-000000000000/approve');
    expect(res.status).toBe(401);
  });

  it('crons de empleos sin CRON_SECRET → 401', async () => {
    for (const p of ['/api/cron/jobs-maintenance', '/api/cron/import-jobs', '/api/cron/expire-jobs']) {
      const res = await request(app).get(p);
      expect(res.status).toBe(401);
    }
  });

  it('GET /api/jobs/empresa/:slug inexistente → [404, 500]', async () => {
    const res = await request(app).get('/api/jobs/empresa/empresa-que-no-existe');
    expect([404, 500]).toContain(res.status);
  });

  it('GET /api/health/config reporta el estado de configuración', async () => {
    const res = await request(app).get('/api/health/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('firebaseProjectId');
    expect(res.body).toHaveProperty('database');
  });
});
