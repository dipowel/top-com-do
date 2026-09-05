import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useShell } from '../hooks/useShell';
import { useSeo } from '../hooks/useSeo';
import { api } from '../lib/api';
import ProfileForm, {
  emptyProfileForm,
  profileFormToPayload,
  type ProfileFormValue,
} from '../components/profile/ProfileForm';
import BusinessCreatedModal, {
  type CreatedBusiness,
} from '../components/profile/BusinessCreatedModal';
import { SITE_URL } from '@shared/site';

/** Pantalla de un solo propósito: el formulario de alta de negocio, sin rodeos. */
export default function RegisterBusinessPage() {
  const { user, refreshMe } = useAuth();
  const { openBid } = useShell();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileFormValue>(emptyProfileForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedBusiness | null>(null);

  useSeo({
    title: 'Registra tu negocio gratis | Top.com.do',
    description:
      'Publica tu negocio en el directorio de Top.com.do en minutos, sin costo, y deja que tus clientes te encuentren.',
    canonical: `${SITE_URL}/registrar-negocio`,
    noindex: true,
  });

  if (!user) {
    return <Navigate to={`/login?registro=1&next=${encodeURIComponent('/registrar-negocio')}`} replace />;
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const c = await api<{ id: string }>('/profiles', {
        method: 'POST',
        body: JSON.stringify(profileFormToPayload(form)),
        auth: true,
      });
      setCreated({
        id: c.id,
        name: form.name,
        categorySlug: form.categorySlug,
        province: form.province,
      });
      void refreshMe();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Registra tu negocio <span className="text-emerald-soft">gratis</span>
        </h1>
        <p className="text-sm text-white/60">
          Aparece en el directorio de Top.com.do y deja que tus clientes te encuentren. Sin costo, en
          minutos.
        </p>
      </header>

      <div className="glass p-4">
        <ProfileForm
          value={form}
          onChange={setForm}
          onSubmit={submit}
          submitLabel="Publicar mi negocio gratis"
          busy={busy}
          error={error}
        />
      </div>

      {created && (
        <BusinessCreatedModal
          business={created}
          onActivateBid={() => {
            const c = created;
            setCreated(null);
            openBid(c.id, c.categorySlug, c.province);
          }}
          onDismiss={() => navigate('/perfil')}
        />
      )}
    </div>
  );
}
