import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verificación de ID tokens de Firebase Auth SIN service account.
 * Solo necesita el projectId: valida la firma contra las claves públicas de
 * Google y comprueba issuer/audience. Ideal para serverless (Vercel).
 *
 * Si algún día se necesita el Admin SDK completo (FCM, gestión de usuarios),
 * se puede añadir FIREBASE_SERVICE_ACCOUNT_BASE64, pero para autenticar no hace falta.
 */
export function firebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'genuine-xray-5dckx'
  );
}

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export interface DecodedIdToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  aud: string;
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const projectId = firebaseProjectId();
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  const uid = (payload.sub || (payload as Record<string, unknown>).user_id) as string;
  if (!uid) throw new Error('El token no incluye sub/user_id');
  return {
    uid,
    email: payload.email as string | undefined,
    name: (payload as Record<string, unknown>).name as string | undefined,
    picture: (payload as Record<string, unknown>).picture as string | undefined,
    aud: String(payload.aud),
  };
}
