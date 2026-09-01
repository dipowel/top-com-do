import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, firebaseReady } from '../lib/firebase';
import { api } from '../lib/api';
import { isAdminEmail } from '../lib/admin';
import { extractRefCode, normalizeRefCode } from '@shared/referral';
import type { MeResponse } from '@shared/types';

function readStoredRef(): string | null {
  try {
    return normalizeRefCode(localStorage.getItem('pendingRef'));
  } catch {
    return null;
  }
}

function storeRef(code: string) {
  try {
    localStorage.setItem('pendingRef', code);
  } catch {
    /* navegador in-app puede bloquear localStorage: el estado en memoria lo sostiene */
  }
}

interface AuthContextValue {
  user: User | null;
  me: MeResponse | null;
  /** true si el backend devolvió rol admin/superadmin, o si el correo está en la lista local. */
  isAdmin: boolean;
  /** 'consumer' | 'merchant' | 'admin' — flujo/UI del usuario. */
  accountType: 'consumer' | 'merchant' | 'admin';
  /** mensaje si `GET /api/me` falló (útil para diagnóstico en Vercel). */
  meError: string | null;
  /** código `?ref=` capturado que se aplicará al registrarse (o null). */
  pendingRef: string | null;
  loading: boolean;
  ready: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(readStoredRef);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    if (!auth?.currentUser) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<MeResponse>('/me', { auth: true }));
      setMeError(null);
    } catch (e) {
      setMe(null);
      setMeError((e as Error).message);
    }
  }

  // Captura ?ref=CODIGO de la URL (validado) en localStorage + estado en memoria.
  useEffect(() => {
    const code = extractRefCode(window.location.search);
    if (code) {
      storeRef(code);
      setPendingRef(code);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // El navbar y las rutas protegidas dependen de ESTE listener de Firebase,
    // no de /api/me: la sesión se refleja aunque el backend tarde o falle.
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await refreshMe();
      } else {
        setMe(null);
        setMeError(null);
      }
    });
  }, []);

  // Aplica el código de referido en cuanto hay sesión (usa el estado en memoria,
  // no localStorage, para funcionar aunque el navegador in-app lo bloquee).
  useEffect(() => {
    if (!user || !pendingRef) return;
    let cancelled = false;
    api('/me/referral', {
      method: 'POST',
      body: JSON.stringify({ code: pendingRef }),
      auth: true,
    })
      .catch(() => {
        /* código inválido / ya referido */
      })
      .finally(() => {
        if (cancelled) return;
        try {
          localStorage.removeItem('pendingRef');
        } catch {
          /* ignore */
        }
        setPendingRef(null);
        void refreshMe();
      });
    return () => {
      cancelled = true;
    };
  }, [user, pendingRef]);

  const isAdmin =
    me?.role === 'admin' || me?.role === 'superadmin' || isAdminEmail(user?.email);
  const accountType = isAdmin ? 'admin' : (me?.accountType ?? 'consumer');

  const value: AuthContextValue = {
    user,
    me,
    isAdmin,
    accountType,
    meError,
    pendingRef,
    loading,
    ready: firebaseReady,
    loginGoogle: async () => {
      await signInWithPopup(auth!, googleProvider);
    },
    loginEmail: async (email, pass) => {
      await signInWithEmailAndPassword(auth!, email, pass);
    },
    registerEmail: async (email, pass, name) => {
      const cred = await createUserWithEmailAndPassword(auth!, email, pass);
      if (name?.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
        await cred.user.getIdToken(true); // refresca el token para que /api/me vea el nombre
      }
    },
    logout: async () => {
      await signOut(auth!);
      setMe(null);
      setMeError(null);
    },
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
