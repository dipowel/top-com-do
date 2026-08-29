import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { useMyReviews } from '../hooks/useMyReviews';
import { api } from '../lib/api';
import { avatarFallback, whatsappLink } from '../lib/share';
import { formatDOP } from '../lib/format';
import Modal from '../components/common/Modal';
import { StarRating } from '../components/reviews/StarRating';
import ProfileForm, {
  emptyProfileForm,
  profileFormToPayload,
  profileToFormValue,
  type ProfileFormValue,
} from '../components/profile/ProfileForm';
import { refShareUrl } from '@shared/site';
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
  province: string | null;
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

const ACCOUNT_BADGE: Record<string, { label: string; cls: string }> = {
  consumer: { label: '👤 Consumidor', cls: 'bg-white/10 text-white/70' },
  merchant: { label: '🏪 Negocio', cls: 'bg-emerald/15 text-emerald-soft' },
  admin: { label: '🛡️ Administrador', cls: 'bg-gold/20 text-gold' },
};

export default function ProfilePage() {
  const { user, me, isAdmin, accountType, meError, logout, refreshMe } = useAuth();
  const { list: favorites, toggle: toggleFav } = useFavorites();
  const { data: myReviews, reload: reloadReviews } = useMyReviews();

  const [form, setForm] = useState<ProfileFormValue>(emptyProfileForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBizForm, setShowBizForm] = useState(false);

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
        <h1 className="text-xl font-extrabold">Tu cuenta</h1>
        <p className="text-sm text-white/50">
          Crea tu cuenta gratis para calificar negocios, guardar favoritos y —si tienes un
          negocio— publicarlo en el directorio.
        </p>
        <Link to="/login?registro=1" className="btn-gold w-full">
          Crear cuenta gratis
        </Link>
        <Link to="/login" className="btn-ghost w-full">
          Ya tengo cuenta
        </Link>
      </div>
    );
  }

  const displayName = user.displayName || me?.displayName || user.email?.split('@')[0] || 'Usuario';
  const refLink = me?.referralCode ? refShareUrl(me.referralCode) : '';
  const credit = me?.creditBalanceDop ?? 0;
  const isMerchant = accountType === 'merchant' || myProfiles.length > 0;
  const badge = ACCOUNT_BADGE[accountType] ?? ACCOUNT_BADGE.consumer;

  async function createProfile() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/profiles', { method: 'POST', body: JSON.stringify(profileFormToPayload(form)), auth: true });
      setMsg('✓ Negocio registrado. Ya aparece en el directorio.');
      setForm(emptyProfileForm);
      setShowBizForm(false);
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

  const favBlock = (
    <div className="glass space-y-2 p-4">
      <h2 className="font-bold">Mis favoritos</h2>
      {favorites.length === 0 ? (
        <p className="text-xs text-white/40">
          Toca ☆ en cualquier negocio para guardarlo aquí.
        </p>
      ) : (
        favorites.map((f) => (
          <div key={f.id} className="flex items-center gap-3">
            <img src={f.avatarUrl || avatarFallback(f.name)} className="h-9 w-9 rounded-lg" alt="" />
            <Link to={`/p/${f.id}`} className="flex-1 truncate text-sm">
              {f.name}
            </Link>
            {f.whatsapp && (
              <a
                href={whatsappLink(f.whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="btn-emerald !py-1 text-[11px]"
              >
                WhatsApp
              </a>
            )}
            <button onClick={() => toggleFav(f.id)} className="btn-ghost !py-1 text-[11px]">
              Quitar
            </button>
          </div>
        ))
      )}
    </div>
  );

  const reviewsBlock = (
    <div className="glass space-y-2 p-4">
      <h2 className="font-bold">Mis reseñas</h2>
      {myReviews.length === 0 ? (
        <p className="text-xs text-white/40">Aún no has calificado ningún negocio.</p>
      ) : (
        myReviews.map((rv) => (
          <div key={rv.id} className="rounded-lg bg-white/5 p-2.5">
            <div className="flex items-center justify-between">
              <Link to={`/p/${rv.profileId}`} className="truncate text-sm font-semibold">
                {rv.profileName}
              </Link>
              <StarRating value={rv.rating} />
            </div>
            {rv.comment && <p className="mt-1 text-xs text-white/60">{rv.comment}</p>}
            {rv.status === 'flagged' && (
              <p className="mt-1 text-[10px] text-amber-300">En revisión por un administrador.</p>
            )}
            {rv.ownerReply && (
              <p className="mt-1 border-l-2 border-gold/40 pl-2 text-[11px] text-white/60">
                <b className="text-gold/70">Respuesta:</b> {rv.ownerReply}
              </p>
            )}
            <button
              onClick={async () => {
                if (confirm('¿Eliminar tu reseña?')) {
                  await api(`/reviews/${rv.id}`, { method: 'DELETE', auth: true });
                  reloadReviews();
                }
              }}
              className="mt-1 text-[10px] text-white/40 underline"
            >
              Eliminar
            </button>
          </div>
        ))
      )}
    </div>
  );

  const referralBlock = (
    <div className="glass space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Saldo por referidos</h2>
        <span className="text-lg font-black text-gold">{formatDOP(credit)}</span>
      </div>
      <p className="text-[11px] text-white/45">
        Gana RD$ 100 cuando un invitado hace su primera puja válida y el admin la aprueba.
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
  );

  const bizBlock = (
    <>
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

      <div className="glass space-y-3 p-4">
        {isMerchant || showBizForm ? (
          <>
            <h2 className="font-bold">
              {myProfiles.length ? 'Registrar otro negocio' : 'Registrar mi negocio en el directorio'}
            </h2>
            <ProfileForm
              value={form}
              onChange={setForm}
              onSubmit={createProfile}
              submitLabel="Registrar negocio"
              busy={busy}
            />
            {msg && <p className="text-xs text-white/60">{msg}</p>}
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold">¿Tienes un negocio?</div>
              <p className="text-[11px] text-white/45">Publícalo gratis y compite por el #1.</p>
            </div>
            <button onClick={() => setShowBizForm(true)} className="btn-gold shrink-0 !py-2 text-xs">
              Publicar negocio
            </button>
          </div>
        )}
      </div>
    </>
  );

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
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${badge.cls}`}>
            {badge.label}
          </span>
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

      {/* Consumidor: favoritos y reseñas primero. Comerciante: negocios primero. */}
      {isMerchant ? (
        <>
          {bizBlock}
          {favBlock}
          {reviewsBlock}
          {referralBlock}
        </>
      ) : (
        <>
          {favBlock}
          {reviewsBlock}
          {referralBlock}
          {bizBlock}
        </>
      )}

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
