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
import type { MeResponse } from '@shared/types';

interface AuthContextValue {
  user: User | null;
  me: MeResponse | null;
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
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      setMe(await api<MeResponse>('/me', { auth: true }));
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await refreshMe();
      else setMe(null);
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    me,
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
    },
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
