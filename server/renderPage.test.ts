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

  it('categoría × provincia', async () => {
    const r = await renderPage('/rd/gastronomia/santiago');
    expect(r.status).toBe(200);
    expect(r.html).toContain('Los mejores Gastronomía y Comida en Santiago');
    expect(r.html).toContain('href="https://www.top.com.do/rd/gastronomia/santiago"');
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
});
