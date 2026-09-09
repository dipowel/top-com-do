import { describe, it, expect } from 'vitest';
import { renderPage } from './lib/renderPage';

/**
 * En el entorno de test `PAGE_SHELL` está vacío (stub) y la BD no responde, así
 * que `renderPage` usa el HTML mínimo de respaldo y las listas quedan vacías.
 * Lo que importa aquí: cada ruta calcula el <title>/canónico/robots correcto.
 */

describe('renderPage · metadatos por ruta', () => {
  it('portada', async () => {
    const r = await renderPage('/');
    expect(r.status).toBe(200);
    expect(r.html).toContain('<title>Top.com.do — Publicidad efectiva y directorio de negocios en República Dominicana</title>');
    expect(r.html).toContain('<link rel="canonical" href="https://www.top.com.do/" />');
    expect(r.html).not.toContain('noindex');
  });

  it('categoría × provincia: título gramatical + canónico geolocalizado', () => {
    return renderPage('/rd/gastronomia/santiago').then((r) => {
      expect(r.status).toBe(200);
      expect(r.html).toContain('Los mejores restaurantes en Santiago');
      expect(r.html).toContain('href="https://www.top.com.do/rd/gastronomia/santiago"');
    });
  });

  it('categoría × provincia sin negocios → noindex (evita thin content)', async () => {
    // En test la BD no responde: la lista queda vacía → debe marcarse noindex.
    const r = await renderPage('/rd/gastronomia/pedernales');
    expect(r.noindex).toBe(true);
    expect(r.html).toContain('noindex');
  });

  it('/explorar/:cat canoniza hacia el ranking /rd/:cat', async () => {
    const r = await renderPage('/explorar/salud');
    expect(r.html).toContain('<link rel="canonical" href="https://www.top.com.do/rd/salud" />');
  });

  it('/publicar lleva FAQPage y título de intención', async () => {
    const r = await renderPage('/publicar');
    expect(r.html).toContain('FAQPage');
    expect(r.html.toLowerCase()).toContain('anuncia tu negocio');
  });

  it('categoría inexistente → 404 + noindex', async () => {
    const r = await renderPage('/rd/no-existe/tampoco');
    expect(r.status).toBe(404);
    expect(r.html).toContain('noindex');
  });

  it('ficha inexistente → 404 + noindex', async () => {
    const r = await renderPage('/p/00000000-0000-0000-0000-000000000000');
    expect(r.status).toBe(404);
    expect(r.html).toContain('noindex');
  });

  it('rutas de cuenta → noindex', async () => {
    const r = await renderPage('/perfil');
    expect(r.status).toBe(200);
    expect(r.html).toContain('noindex');
  });

  it('el modo "Cerca de mí" no filtra al SSR: sin nearby/lat/cerca-de-mi en el HTML', async () => {
    const r = await renderPage('/rd/gastronomia/santiago');
    expect(r.html).not.toMatch(/nearby|cerca-de-mi|[?&]lat=/i);
  });

  it('/seguridad-pagos: página legal indexable con su título', async () => {
    const r = await renderPage('/seguridad-pagos');
    expect(r.status).toBe(200);
    expect(r.noindex).toBe(false);
    expect(r.html).toContain('Seguridad para la Transmisión de Datos de Tarjetas');
    expect(r.html).toContain('<link rel="canonical" href="https://www.top.com.do/seguridad-pagos" />');
  });

  it('/recibo y /recibo/:id → noindex (comprobante privado)', async () => {
    expect((await renderPage('/recibo')).noindex).toBe(true);
    expect((await renderPage('/recibo/abc123')).noindex).toBe(true);
  });

  it('/empleos: indexable con su título aunque la lista esté vacía', async () => {
    const r = await renderPage('/empleos');
    expect(r.status).toBe(200);
    expect(r.noindex).toBe(false);
    expect(r.html).toContain('<title>Empleos en República Dominicana · Top.com.do</title>');
    expect(r.html).toContain('<link rel="canonical" href="https://www.top.com.do/empleos" />');
  });

  it('/empleos/publicar y /empleos/mis-vacantes → noindex (rutas privadas)', async () => {
    expect((await renderPage('/empleos/publicar')).noindex).toBe(true);
    expect((await renderPage('/empleos/mis-vacantes')).noindex).toBe(true);
  });

  it('/empleos/:categoria sin datos (test) → noindex (guard de thin content)', async () => {
    const r = await renderPage('/empleos/tecnologia');
    expect(r.status).toBe(200);
    expect(r.noindex).toBe(true);
  });

  it('/empleos/:filtro inválido → 404 + noindex', async () => {
    const r = await renderPage('/empleos/no-existe-nada');
    expect(r.status).toBe(404);
    expect(r.html).toContain('noindex');
  });

  it('/empleo/:slug inexistente → 404 + noindex', async () => {
    const r = await renderPage('/empleo/vacante-que-no-existe');
    expect(r.status).toBe(404);
    expect(r.html).toContain('noindex');
  });

  it('/empleos y sus landings NUNCA llevan JobPosting', async () => {
    for (const p of ['/empleos', '/empleos/tecnologia', '/empleos/categoria/ventas', '/empleos/empresa/acme']) {
      const r = await renderPage(p);
      expect(r.html).not.toContain('"@type":"JobPosting"');
    }
  });

  it('/empleos/categoria/:cat canoniza a la forma corta /empleos/:cat', async () => {
    const r = await renderPage('/empleos/categoria/tecnologia');
    expect(r.status).toBe(200);
    expect(r.html).toContain('<link rel="canonical" href="https://www.top.com.do/empleos/tecnologia" />');
  });

  it('/empleos/empresa/:slug sin vacantes → noindex', async () => {
    const r = await renderPage('/empleos/empresa/empresa-inexistente');
    expect(r.status).toBe(200);
    expect(r.noindex).toBe(true);
  });
});
