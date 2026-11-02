import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSeo } from '../../hooks/useSeo';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import JobForm, { emptyJobForm, jobFormToPayload, type JobFormValue } from '../../components/jobs/JobForm';
import { SITE_URL } from '@shared/site';

interface MyProfile {
  id: string;
  name: string;
}

export default function PublicarEmpleoPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<JobFormValue>(emptyJobForm);
  const [myProfiles, setMyProfiles] = useState<MyProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; title: string } | null>(null);
  const started = useRef(false);

  useSeo({
    title: 'Publica una vacante gratis | Top.com.do',
    description:
      'Publica tu oferta de empleo gratis en Top.com.do y llega a candidatos en toda la República Dominicana.',
    canonical: `${SITE_URL}/empleos/publicar`,
    noindex: true,
  });

  useEffect(() => {
    if (!user) return;
    api<MyProfile[]>('/me/profiles', { auth: true })
      .then((rows) => setMyProfiles(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setMyProfiles([]));
  }, [user]);

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent('/empleos/publicar')}`} replace />;
  }

  async function submit() {
    setError(null);
    if (!started.current) {
      track('job_post_start');
      started.current = true;
    }
    setBusy(true);
    try {
      const res = await api<{ slug: string }>('/jobs', {
        method: 'POST',
        body: JSON.stringify(jobFormToPayload(form, 'published')),
        auth: true,
      });
      track('job_post_complete', { category: form.category });
      setDone({ slug: res.slug, title: form.title });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const url = `${SITE_URL}/empleo/${done.slug}`;
    const shareText = `💼 Estamos contratando: ${done.title}\n${url}`;
    return (
      <div className="glass mx-auto max-w-md space-y-4 p-6 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-extrabold text-white">¡Vacante publicada!</h1>
        <p className="text-sm text-white/60">Ya es visible en Top.com.do y aparecerá en los buscadores.</p>
        <div className="flex flex-col gap-2">
          <Link to={`/empleo/${done.slug}`} className="btn-gold w-full">
            Ver la vacante
          </Link>
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-emerald w-full"
          >
            Compartir por WhatsApp
          </a>
          <Link to="/empleos/mis-vacantes" className="btn-ghost w-full text-sm">
            Gestionar mis vacantes
          </Link>
        </div>
        {!myProfiles.length && (
          <div className="glass space-y-1.5 border border-gold/25 p-3 text-left">
            <p className="text-xs font-bold text-gold">¿Tienes un negocio?</p>
            <p className="text-[11px] text-white/55">Aparece también en el ranking de tu zona, gratis.</p>
            <Link to="/registrar-negocio" className="btn-ghost block !py-1.5 text-center text-xs">
              Registrar mi negocio gratis
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Publica una vacante</h1>
        <p className="text-sm text-white/55">
          Gratis. Llega a candidatos en toda la RD. Cuéntanos del puesto y cómo aplicar.
        </p>
      </header>
      {!myProfiles.length && (
        <div className="glass flex flex-wrap items-center justify-between gap-2 border border-gold/25 p-3.5">
          <div>
            <p className="text-xs font-bold text-gold">¿Tienes un negocio?</p>
            <p className="text-[11px] text-white/55">Aparece también en el ranking de tu zona, gratis.</p>
          </div>
          <Link to="/registrar-negocio" className="btn-ghost shrink-0 !py-1.5 text-xs">
            Registrarlo gratis
          </Link>
        </div>
      )}
      <JobForm
        value={form}
        onChange={setForm}
        onSubmit={submit}
        submitLabel="Publicar vacante"
        busy={busy}
        error={error}
        myProfiles={myProfiles}
      />
    </div>
  );
}
