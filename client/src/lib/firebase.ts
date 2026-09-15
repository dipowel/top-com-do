import type { Auth, GoogleAuthProvider } from 'firebase/auth';

/**
 * Config web de Firebase (proyecto genuine-xray-5dckx).
 * NO es secreta: la config web se incrusta en el cliente por diseño; la
 * seguridad la dan los "Authorized domains" + Security Rules de Firebase.
 * Las variables VITE_FIREBASE_* la sobreescriben si están definidas.
 *
 * El SDK de Firebase Auth (~170 KB) se carga con import() dinámico DESPUÉS del
 * primer render: el visitante anónimo y los bots nunca bloquean el LCP con él.
 *
 * `authDomain` por defecto = el de Firebase Hosting (`genuine-xray-5dckx.firebaseapp.com`),
 * distinto del dominio del sitio (`www.top.com.do`). Para que Google muestre "Ir a
 * top.com.do" y para que `signInWithRedirect` funcione de forma fiable en móvil, hay
 * que conectar un subdominio propio (p. ej. `auth.top.com.do`) a Firebase Hosting,
 * verificarlo por DNS, y entonces poner `VITE_FIREBASE_AUTH_DOMAIN=auth.top.com.do`
 * en Vercel — NO se cambia este valor por defecto hasta que ese dominio esté
 * verificado (si no, el login se rompe por completo). `useAuth.tsx::loginGoogle`
 * detecta esa variable para activar el respaldo a redirect automáticamente.
 */
const FALLBACK = {
  apiKey: 'AIzaSyAkX68nJeE1gIL9wVqzUiXMC53BGU7CDcY',
  authDomain: 'genuine-xray-5dckx.firebaseapp.com',
  projectId: 'genuine-xray-5dckx',
  storageBucket: 'genuine-xray-5dckx.firebasestorage.app',
  messagingSenderId: '472999366962',
  appId: '1:472999366962:web:a07824b962092cf3b9472b',
};

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FALLBACK.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FALLBACK.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK.appId,
};

export const firebaseReady = Boolean(config.apiKey && config.projectId && config.appId);

/** Instancia ya resuelta, para lecturas síncronas rápidas (`currentUser`) una vez cargada. */
export let authInstance: Auth | null = null;

let authPromise: Promise<Auth | null> | null = null;

/** Carga (una sola vez) el SDK de Firebase Auth e inicializa la app. */
export function loadAuth(): Promise<Auth | null> {
  if (!firebaseReady) return Promise.resolve(null);
  authPromise ??= (async () => {
    const [{ initializeApp }, { getAuth }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    authInstance = getAuth(initializeApp(config));
    return authInstance;
  })();
  return authPromise;
}

export async function loadGoogleProvider(): Promise<GoogleAuthProvider> {
  const { GoogleAuthProvider } = await import('firebase/auth');
  return new GoogleAuthProvider();
}
