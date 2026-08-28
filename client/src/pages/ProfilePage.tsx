import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { avatarFallback, whatsappLink } from '../lib/share';
import { formatDOP } from '../lib/format';
import Modal from '../components/common/Modal';
import ProfileForm, {
  emptyProfileForm,
  profileFormToPayload,
  profileToFormValue,
  type ProfileFormValue,
} from '../components/profile/ProfileForm';
import type { MyReferral } from '@shared/types';

interface MyProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  categorySlug: string;
  categoryName: string;
  subcategory: string | null;
  tagline: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

const REF_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Esperando 1ª puja', cls: 'text-white/50' },
  eligible: { label: 'Puja válida — falta que el admin libere', cls: 'text-amber-300' },
  approved: { label: 'Bono acreditado', cls: 'text-emerald-soft' },
  rejected: { label: 'Rechazado', cls: 'text-red-300' },
};

export default function ProfilePage() {
  const { user, me, isAdmin, meError, logout, refreshMe } = useAuth();
  const [form, setForm] = useState<ProfileFormValue>(emptyProfileForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [referrals, setReferrals] = useState<MyReferral[]>([]);
  const [myProfiles, setMyProfiles] = useState<MyProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<MyProfile | null>(null);

  const loadExtras = useCallback(async () => {
    if (!user) return;
    try {
      setReferrals(await api<MyReferral[]>('/me/referrals', { auth: true }));
    } catch {
      /* ignore */
    }
    try {
      setMyProfiles(await api<MyProfile[]>('/me/profiles', { auth: true }));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-extrabold">Tu perfil</h1>
        <p className="text-sm text-white/50">
          Inicia sesión para pujar, guardar favoritos y registrar tu negocio en el directorio.
        </p>
        <Link to="/login" className="btn-gold w-full">
          Iniciar sesión / Registrarse
        </Link>
      </div>
    );
  }

  const displayName = user.displayName || me?.displayName || user.email?.split('@')[0] || 'Usuario';
  const refLink = me?.referralCode
    ? `${window.location.origin}/?ref=${me.referralCode}`
    : '';
  const credit = me?.creditBalanceDop ?? 0;

  async function createProfile() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/profiles', { method: 'POST', body: JSON.stringify(profileFormToPayload(form)), auth: true });
      setMsg('✓ Negocio registrado. Ya aparece en el directorio.');
      setForm(emptyProfileForm);
      void refreshMe();
      void loadExtras();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(refLink);
    } catch {
      /* ignore */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

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

      {/* Saldo por referidos */}
      <div className="glass space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Saldo por referidos</h2>
          <span className="text-lg font-black text-gold">{formatDOP(credit)}</span>
        </div>
        <p className="text-[11px] text-white/45">
          Gana RD$ 100 cuando un invitado hace su primera puja válida y el admin la aprueba. Usa el
          saldo para anunciarte gratis.
        </p>

        {refLink && (
          <div className="rounded-xl bg-white/5 p-2.5">
            <div className="text-[11px] text-white/40">Tu enlace de invitación</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate text-xs">{refLink}</code>
              <button onClick={copyRef} className="btn-ghost shrink-0 !py-1 text-xs">
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
              <a
                href={whatsappLink(undefined, `Únete a Top.com.do con mi enlace: ${refLink}`)}
                target="_blank"
                rel="noreferrer"
                className="btn-emerald shrink-0 !py-1 text-xs"
              >
                Compartir
              </a>
            </div>
          </div>
        )}

        {referrals.length > 0 && (
          <div className="space-y-1.5">
            {referrals.map((rf) => (
              <div key={rf.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-white/70">
                  {rf.referredName || rf.referredEmail || 'Invitado'}
                </span>
                <span className={REF_STATUS[rf.status]?.cls}>{REF_STATUS[rf.status]?.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mis negocios */}
      {myProfiles.length > 0 && (
        <div className="glass space-y-2 p-4">
          <h2 className="font-bold">Mis negocios</h2>
          {myProfiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <img src={p.avatarUrl || avatarFallback(p.name)} className="h-10 w-10 rounded-lg" alt="" />
              <div className="min-w-0 flex-1">
                <Link to={`/p/${p.id}`} className="truncate text-sm font-semibold">
                  {p.name}
                </Link>
                <div className="truncate text-[11px] text-white/40">
                  {p.subcategory ? `${p.subcategory} · ` : ''}
                  {p.categoryName}
                  {p.latitude != null ? ' · 📍 con ubicación' : ' · sin ubicación'}
                </div>
              </div>
              <button onClick={() => setEditing(p)} className="btn-ghost !py-1.5 text-xs">
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Registrar negocio */}
      <div className="glass space-y-3 p-4">
        <h2 className="font-bold">Registrar mi negocio en el directorio</h2>
        <ProfileForm
          value={form}
          onChange={setForm}
          onSubmit={createProfile}
          submitLabel="Registrar negocio"
          busy={busy}
        />
        {msg && <p className="text-xs text-white/60">{msg}</p>}
      </div>

      {editing && (
        <EditProfileModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadExtras();
          }}
        />
      )}
    </div>
  );
}

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: MyProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProfileFormValue>(profileToFormValue(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/profiles/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify(profileFormToPayload(form)),
        auth: true,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Editar · ${profile.name}`}>
      <ProfileForm
        value={form}
        onChange={setForm}
        onSubmit={save}
        submitLabel="Guardar cambios"
        busy={busy}
        error={error}
      />
    </Modal>
  );
}
