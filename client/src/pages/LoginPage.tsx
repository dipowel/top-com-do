import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { normalizeRefCode } from '@shared/referral';

export default function LoginPage() {
  const { loginGoogle, loginEmail, registerEmail, user, ready, pendingRef } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    params.get('registro') ? 'register' : 'login',
  );

  // Si el enlace fue /login?ref=CODIGO, guárdalo también aquí.
  useEffect(() => {
    const code = normalizeRefCode(params.get('ref'));
    if (code) {
      try {
        localStorage.setItem('pendingRef', code);
      } catch {
        /* ignore */
      }
    }
  }, [params]);

  const refCode = pendingRef || normalizeRefCode(params.get('ref'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get('next') || '/';

  useEffect(() => {
    if (user) nav(next, { replace: true });
  }, [user, nav, next]);

  if (!ready) {
    return (
      <div className="glass p-4 text-sm text-white/60">
        Firebase no está configurado. Agrega <code>VITE_FIREBASE_*</code> en el entorno para habilitar el
        acceso.
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'login') await loginEmail(email, pass);
      else await registerEmail(email, pass, name);
      nav(next, { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <img src="/logo.png" alt="Top.com.do" className="mx-auto h-12 w-auto" />
      <p className="text-center text-xs text-white/45">
        {mode === 'register'
          ? 'Crea tu cuenta gratis para calificar negocios y guardar favoritos'
          : 'El directorio #1 de RD'}
      </p>

      {mode === 'register' && refCode && (
        <p className="rounded-lg border border-emerald/30 bg-emerald/10 px-3 py-2 text-center text-xs text-emerald-soft">
          🎁 Código de invitación aplicado: <b>{refCode}</b> — al registrarte, ambos ganan RD$ 100.
        </p>
      )}

      <button
        onClick={() =>
          loginGoogle()
            .then(() => nav(next))
            .catch((e) => setErr((e as Error).message))
        }
        className="btn-ghost w-full"
      >
        Continuar con Google
      </button>
      <div className="text-center text-xs text-white/30">o con tu correo</div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <input
            className="input"
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Contraseña (mín. 6)"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
          minLength={6}
        />
        <button disabled={busy} className="btn-gold w-full">
          {busy ? '…' : mode === 'login' ? 'Entrar' : 'Crear mi cuenta'}
        </button>
      </form>

      {err && <p className="text-center text-xs text-red-400">{err}</p>}

      <button
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setErr(null);
        }}
        className="w-full text-center text-xs text-white/50"
      >
        {mode === 'login' ? '¿Nuevo aquí? Crea tu cuenta gratis' : '¿Ya tienes cuenta? Inicia sesión'}
      </button>

      {mode === 'register' && (
        <p className="text-center text-[10px] text-white/30">
          ¿Tienes un negocio? Regístrate igual y publícalo después desde tu perfil.
        </p>
      )}
    </div>
  );
}
