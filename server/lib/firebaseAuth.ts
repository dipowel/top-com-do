/**
 * Verificación de ID tokens de Firebase Auth SIN service account.
 * Solo necesita el projectId: valida la firma contra las claves públicas de
 * Google y comprueba issuer/audience. `jose` se carga de forma perezosa para
 * no pesar en el arranque de la función serverless.
 */
export function firebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'genuine-xray-5dckx'
  );
}

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jwks: any;

export interface DecodedIdToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  aud: string;
}

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  jwks ??= createRemoteJWKSet(new URL(JWKS_URL));

  const projectId = firebaseProjectId();
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const p = payload as Record<string, unknown>;
  const uid = (p.sub || p.user_id) as string;
  if (!uid) throw new Error('El token no incluye sub/user_id');

  return {
    uid,
    email: p.email as string | undefined,
    name: p.name as string | undefined,
    picture: p.picture as string | undefined,
    aud: String(payload.aud),
  };
}
