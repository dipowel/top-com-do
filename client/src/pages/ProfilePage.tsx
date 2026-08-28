import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { avatarFallback } from '../lib/share';
import ProfileForm, {
  emptyProfileForm,
  profileFormToPayload,
  type ProfileFormValue,
} from '../components/profile/ProfileForm';

export default function ProfilePage() {
  const { user, me, isAdmin, meError, logout, refreshMe } = useAuth();
  const [form, setForm] = useState<ProfileFormValue>(emptyProfileForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-extrabold">Tu perfil</h1>
        <p className="text-sm text-white/50">
          Inicia sesión para pujar, guardar favoritos y registrar tu perfil de marca o persona.
        </p>
        <Link to="/login" className="btn-gold w-full">
          Iniciar sesión / Registrarse
        </Link>
      </div>
    );
  }

  async function createProfile() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/profiles', { method: 'POST', body: JSON.stringify(profileFormToPayload(form)), auth: true });
      setMsg('✓ Perfil registrado. Ya puede recibir pujas.');
      setForm(emptyProfileForm);
      void refreshMe();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const displayName =
    user.displayName || me?.displayName || user.email?.split('@')[0] || 'Usuario';

  return (
    <div className="space-y-5">
      <div className="glass flex items-center gap-3 p-4">
        <img
          src={me?.photoUrl || user.photoURL || avatarFallback(displayName)}
          className="h-14 w-14 rounded-xl"
          alt=""
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{displayName}</div>
          <div className="truncate text-xs text-white/40">{me?.email || user.email}</div>
          {isAdmin && (
            <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-gold">
              {me?.role ?? 'administrador'}
            </span>
          )}
        </div>
        <button onClick={() => void logout()} className="btn-ghost !py-1.5 text-xs">
          Salir
        </button>
      </div>

      {meError && (
        <div className="glass p-3 text-xs text-amber-300">
          Sesión iniciada, pero el servidor no la confirmó: <b>{meError}</b>.
        </div>
      )}

      {isAdmin && (
        <Link to="/admin" className="btn-gold w-full">
          Ir al panel de administración
        </Link>
      )}

      <div className="glass space-y-3 p-4">
        <h2 className="font-bold">Registrar perfil de marca / persona</h2>
        <ProfileForm
          value={form}
          onChange={setForm}
          onSubmit={createProfile}
          submitLabel="Registrar perfil"
          busy={busy}
        />
        {msg && <p className="text-xs text-white/60">{msg}</p>}
      </div>
    </div>
  );
}
