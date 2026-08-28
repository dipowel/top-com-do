import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, firebaseReady } from '../lib/firebase';
import { api } from '../lib/api';
import { isAdminEmail } from '../lib/admin';
import type { MeResponse } from '@shared/types';

interface AuthContextValue {
  user: User | null;
  me: MeResponse | null;
  /** true si el backend devolvió rol admin/superadmin, o si el correo está en la lista local. */
  isAdmin: boolean;
  /** mensaje si `GET /api/me` falló (útil para diagnóstico en Vercel). */
  meError: string | null;
  loading: boolean;
  ready: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string) => Promise<void>;
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

  // Captura ?ref=CODIGO de la URL y lo guarda hasta que el usuario inicie sesión.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) {
      try {
        localStorage.setItem('pendingRef', code.trim().toUpperCase());
      } catch {
        /* ignore */
      }
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
        // Registra al referente si venía un ?ref pendiente
        let pendingRef: string | null = null;
        try {
          pendingRef = localStorage.getItem('pendingRef');
        } catch {
          /* ignore */
        }
        if (pendingRef) {
          try {
            await api('/me/referral', { method: 'POST', body: JSON.stringify({ code: pendingRef }), auth: true });
          } catch {
            /* código inválido / ya registrado */
          }
          try {
            localStorage.removeItem('pendingRef');
          } catch {
            /* ignore */
          }
        }
        await refreshMe();
      } else {
        setMe(null);
        setMeError(null);
      }
    });
  }, []);

  const isAdmin =
    me?.role === 'admin' || me?.role === 'superadmin' || isAdminEmail(user?.email);

  const value: AuthContextValue = {
    user,
    me,
    isAdmin,
    meError,
    loading,
    ready: firebaseReady,
    loginGoogle: async () => {
      await signInWithPopup(auth!, googleProvider);
    },
    loginEmail: async (email, pass) => {
      await signInWithEmailAndPassword(auth!, email, pass);
    },
    registerEmail: async (email, pass) => {
      await createUserWithEmailAndPassword(auth!, email, pass);
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
