import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let cached: App | undefined;

function init(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 no está configurada');
  }
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  return initializeApp({ credential: cert(json) });
}

export function adminAuth(): Auth {
  cached ??= init();
  return getAuth(cached);
}
