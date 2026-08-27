import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { loginGoogle, loginEmail, registerEmail, user, ready } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) nav('/perfil', { replace: true });
  }, [user, nav]);

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
      else await registerEmail(email, pass);
      nav('/', { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <h1 className="text-center text-2xl font-extrabold">
        Top<span className="text-gold">.com.do</span>
      </h1>
      <button
        onClick={() =>
          loginGoogle()
            .then(() => nav('/'))
            .catch((e) => setErr((e as Error).message))
        }
        className="btn-ghost w-full"
      >
        Continuar con Google
      </button>
      <div className="text-center text-xs text-white/30">o con tu correo</div>
      <form onSubmit={submit} className="space-y-3">
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
          placeholder="Contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
          minLength={6}
        />
        <button disabled={busy} className="btn-gold w-full">
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
      {err && <p className="text-center text-xs text-red-400">{err}</p>}
      <button
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="w-full text-center text-xs text-white/50"
      >
        {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
      </button>
    </div>
  );
}
