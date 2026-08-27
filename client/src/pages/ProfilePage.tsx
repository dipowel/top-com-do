import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCategories } from '../hooks/useCategories';
import { api } from '../lib/api';
import { avatarFallback } from '../lib/share';

const emptyForm = { name: '', handle: '', categorySlug: '', whatsapp: '', bio: '', city: '' };

export default function ProfilePage() {
  const { user, me, logout, refreshMe } = useAuth();
  const cats = useCategories();
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-extrabold">Tu perfil</h1>
        <p className="text-sm text-white/50">
          Inicia sesión para pujar, guardar favoritos y crear tu perfil de marca o persona.
        </p>
        <Link to="/login" className="btn-gold w-full">
          Iniciar sesión / Registrarse
        </Link>
      </div>
    );
  }

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api('/profiles', { method: 'POST', body: JSON.stringify(form), auth: true });
      setMsg('✓ Perfil creado. Ya puede recibir pujas.');
      setForm(emptyForm);
      void refreshMe();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';

  return (
    <div className="space-y-5">
      <div className="glass flex items-center gap-3 p-4">
        <img
          src={me?.photoUrl || avatarFallback(me?.displayName || user.email || 'U')}
          className="h-14 w-14 rounded-xl"
          alt=""
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{me?.displayName || 'Usuario'}</div>
          <div className="truncate text-xs text-white/40">{me?.email}</div>
          {isAdmin && (
            <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-gold">
              {me?.role}
            </span>
          )}
        </div>
        <button onClick={() => void logout()} className="btn-ghost !py-1.5 text-xs">
          Salir
        </button>
      </div>

      {isAdmin && (
        <Link to="/admin" className="btn-gold w-full">
          Ir al panel de administración
        </Link>
      )}

      <form onSubmit={createProfile} className="glass space-y-3 p-4">
        <h2 className="font-bold">Crear perfil de marca / persona</h2>
        <input
          required
          className="input"
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          className="input"
          placeholder="handle (ej. mi-marca)"
          value={form.handle}
          onChange={(e) => setForm({ ...form, handle: e.target.value })}
        />
        <select
          required
          className="input"
          value={form.categorySlug}
          onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
        >
          <option value="">Categoría…</option>
          {cats
            .filter((c) => c.slug !== 'todo-rd')
            .map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
        </select>
        <input
          className="input"
          placeholder="WhatsApp (ej. 18091234567)"
          value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
        />
        <input
          className="input"
          placeholder="Ciudad"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <textarea
          className="input"
          placeholder="Bio"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <button disabled={busy} className="btn-gold w-full">
          {busy ? 'Creando…' : 'Crear perfil'}
        </button>
        {msg && <p className="text-xs text-white/60">{msg}</p>}
      </form>
    </div>
  );
}
