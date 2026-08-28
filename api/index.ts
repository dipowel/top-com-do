import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Entrada serverless de Vercel para todas las rutas /api/* (ver rewrites en vercel.json).
 * Carga el app de Express de forma perezosa y captura cualquier error de
 * inicialización para devolver JSON legible en vez de la página de error de Vercel.
 */
let appPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

function loadApp() {
  appPromise ??= import('../server/app').then((m) => m.default as never);
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await loadApp();
    return app(req, res);
  } catch (err) {
    appPromise = null; // permite reintentar en la próxima invocación
    console.error('[api] fallo al inicializar la aplicación:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(
      JSON.stringify({
        error: 'Error de inicialización del servidor',
        detail: String((err as Error)?.message || err),
      }),
    );
  }
}
