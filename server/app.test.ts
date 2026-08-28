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

  it('POST /api/bids sin token → 401', async () => {
    const res = await request(app).post('/api/bids').send({ profileId: 'x', method: 'paypal', amount: 10 });
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/overview sin token → 401', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('ruta desconocida bajo /api → 404 JSON', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('GET /api/health/config reporta el estado de configuración', async () => {
    const res = await request(app).get('/api/health/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('firebaseServiceAccountSet');
    expect(res.body).toHaveProperty('database');
  });
});
