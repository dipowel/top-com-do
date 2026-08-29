import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Entrada serverless de Vercel para /api/* (ver rewrites en vercel.json).
 *
 * `./_server.mjs` lo genera `npm run build:api` (esbuild) empaquetando
 * `server/app.ts`. Se hace así porque Vercel solo empaqueta el contenido de
 * `api/`; importar `../server/app` directamente fallaba con
 * "Cannot find module '/var/task/server/app'".
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let appPromise: Promise<Handler> | null = null;

function loadApp(): Promise<Handler> {
  // @ts-ignore  — archivo generado en build; no existe en el árbol de fuentes
  appPromise ??= import('./_server.mjs').then((m) => m.default as Handler);
  return appPromise;
}

async function bufferRawBody(req: IncomingMessage): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await loadApp();
    // Webhooks: la verificación de firma necesita los bytes exactos del cuerpo.
    // En Vercel el stream puede consumirse antes de que Express lo lea, así que
    // lo bufferizamos aquí y el router del webhook usa `req.rawBody`.
    if (req.url && req.url.startsWith('/api/webhooks/')) {
      await bufferRawBody(req);
    }
    return app(req, res);
  } catch (err) {
    appPromise = null;
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
