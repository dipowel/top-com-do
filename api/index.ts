import app from '../server/app';

// Vercel monta esta función serverless para todas las rutas /api/*
// (ver rewrites en vercel.json). Express funciona como handler nativo.
export default app;
