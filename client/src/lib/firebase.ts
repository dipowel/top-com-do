import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

/**
 * Config web de Firebase (proyecto genuine-xray-5dckx).
 * NO es secreta: la config web se incrusta en el cliente por diseño; la
 * seguridad la dan los "Authorized domains" + Security Rules de Firebase.
 * Las variables VITE_FIREBASE_* la sobreescriben si están definidas.
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

export const firebaseApp: FirebaseApp | null = firebaseReady ? initializeApp(config) : null;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();
