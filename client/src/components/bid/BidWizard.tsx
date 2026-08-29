import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../common/Modal';
import BiddingCheckoutModal from './BiddingCheckoutModal';
import ProfileForm, {
  emptyProfileForm,
  profileFormToPayload,
  type ProfileFormValue,
} from '../profile/ProfileForm';
import { avatarFallback } from '../../lib/share';
import { categoryLabel } from '@shared/seo';
import { provinceName } from '@shared/provinces';
import type { SuggestedBid } from '@shared/types';

interface Profile {
  id: string;
  name: string;
  handle: string;
  categoryName?: string;
  avatarUrl?: string | null;
}

type Mode = 'existing' | 'new';

export default function BidWizard({
  presetProfileId,
  presetCategory,
  presetProvince,
  onClose,
}: {
  presetProfileId?: string;
  presetCategory?: string;
  presetProvince?: string;
  onClose: () => void;
}) {
  const { user, ready } = useAuth();
  const [mode, setMode] = useState<Mode>('existing');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState(presetProfileId ?? '');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<ProfileFormValue>({
    ...emptyProfileForm,
    categorySlug: presetCategory && presetCategory !== 'todo-rd' ? presetCategory : '',
    province: presetProvince && presetProvince !== 'todo-rd' ? presetProvince : '',
  });

  const [suggested, setSuggested] = useState<SuggestedBid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<Profile[]>('/profiles').then(setProfiles).catch(() => setProfiles([]));
  }, []);

  const loadSuggested = useCallback(
    async (pid?: string) => {
      try {
        const params = new URLSearchParams();
        if (pid) params.set('profileId', pid);
        else {
          if (presetCategory) params.set('category', presetCategory);
          if (presetProvince && presetProvince !== 'todo-rd') params.set('province', presetProvince);
        }
        const q = params.toString();
        setSuggested(await api<SuggestedBid>(`/bids/suggested${q ? `?${q}` : ''}`));
      } catch {
        setSuggested(null);
      }
    },
    [presetCategory, presetProvince],
  );

  useEffect(() => {
    if (presetProfileId) void loadSuggested(presetProfileId);
  }, [presetProfileId, loadSuggested]);

  const selected = useMemo(() => profiles.find((p) => p.id === profileId), [profiles, profileId]);
  const filtered = useMemo(
    () =>
      profiles
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.handle.includes(query.toLowerCase()),
        )
        .slice(0, 24),
    [profiles, query],
  );

  function chooseExisting(p: Profile) {
    setProfileId(p.id);
    void loadSuggested(p.id);
  }

  async function createProfileThenBid() {
    setError(null);
    setCreating(true);
    try {
      if (form.tagline.length > 60) throw new Error('El mensaje corto no puede pasar de 60 caracteres');
      const created = await api<{ id: string }>('/profiles', {
        method: 'POST',
        body: JSON.stringify(profileFormToPayload(form)),
        auth: true,
      });
      setProfiles((prev) => [
        { id: created.id, name: form.name, handle: form.name, categoryName: categoryLabel(form.categorySlug) },
        ...prev,
      ]);
      setProfileId(created.id);
      await loadSuggested(created.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (!ready) {
    return (
      <Modal onClose={onClose} title="Pujar Ahora">
        <p className="text-sm text-white/60">
          La autenticación no está configurada. Agrega las claves <code>VITE_FIREBASE_*</code>.
        </p>
      </Modal>
    );
  }
  if (!user) {
    return (
      <Modal onClose={onClose} title="Pujar Ahora">
        <p className="text-sm text-white/60">Necesitas iniciar sesión para pujar.</p>
        <Link to="/login" onClick={onClose} className="btn-gold mt-4 w-full">
          Iniciar sesión
        </Link>
      </Modal>
    );
  }

  // Perfil elegido → checkout
  if (profileId) {
    const provSlug =
      presetProvince && presetProvince !== 'todo-rd' ? presetProvince : form.province || undefined;
    return (
      <BiddingCheckoutModal
        profileId={profileId}
        profileName={selected?.name || form.name}
        categoryName={selected?.categoryName || categoryLabel(form.categorySlug) || undefined}
        provinceName={provSlug ? provinceName(provSlug) : undefined}
        suggestedDop={suggested?.next}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal onClose={onClose} title="Pujar Ahora">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('existing')}
            className={`rounded-xl border p-3 text-sm ${mode === 'existing' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
          >
            📈 Perfil del ranking
          </button>
          <button
            onClick={() => setMode('new')}
            className={`rounded-xl border p-3 text-sm ${mode === 'new' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
          >
            ✨ Registrar nuevo
          </button>
        </div>

        {mode === 'existing' && (
          <>
            <input
              className="input"
              placeholder="Buscar perfil o marca…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => chooseExisting(p)}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/10 p-2 text-left text-sm hover:bg-white/5"
                >
                  <img src={p.avatarUrl || avatarFallback(p.name)} className="h-8 w-8 rounded-lg" alt="" />
                  <span className="flex-1">
                    <span className="font-semibold">{p.name}</span>{' '}
                    <span className="text-white/40">@{p.handle}</span>
                  </span>
                </button>
              ))}
              {!filtered.length && (
                <p className="py-6 text-center text-xs text-white/40">
                  Sin resultados. Usa “Registrar nuevo”.
                </p>
              )}
            </div>
          </>
        )}

        {mode === 'new' && (
          <ProfileForm
            value={form}
            onChange={setForm}
            onSubmit={createProfileThenBid}
            submitLabel="Continuar al pago"
            busy={creating}
            error={error}
          />
        )}
      </div>
    </Modal>
  );
}
