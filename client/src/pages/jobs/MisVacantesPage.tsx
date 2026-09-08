import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSeo } from '../../hooks/useSeo';
import { api } from '../../lib/api';
import Spinner from '../../components/common/Spinner';
import Modal from '../../components/common/Modal';
import JobForm, { emptyJobForm, jobFormToPayload, type JobFormValue } from '../../components/jobs/JobForm';
import { SITE_URL } from '@shared/site';
import type { JobDetail } from '@shared/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  expired: 'Expirada',
  closed: 'Cerrada',
};

function toForm(j: JobDetail): JobFormValue {
  return {
    ...emptyJobForm,
    title: j.title,
    description: j.description,
    requirements: j.requirements ?? '',
    responsibilities: j.responsibilities ?? '',
    companyId: j.companyId ?? '',
    companyName: j.companyName,
    category: j.category,
    province: j.province ?? '',
    city: j.city ?? '',
    locationText: j.locationText ?? '',
    jobType: j.jobType,
    workMode: j.workMode,
    salaryMin: j.salaryMin != null ? String(j.salaryMin) : '',
    salaryMax: j.salaryMax != null ? String(j.salaryMax) : '',
    salaryCurrency: j.salaryCurrency || 'DOP',
    salaryPeriod: j.salaryPeriod ?? '',
    applicationUrl: j.applicationUrl ?? '',
    applicationEmail: j.applicationEmail ?? '',
    contactWhatsapp: j.contactWhatsapp ?? '',
  };
}

export default function MisVacantesPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobDetail[] | null>(null);
  const [editing, setEditing] = useState<JobDetail | null>(null);
  const [form, setForm] = useState<JobFormValue>(emptyJobForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: 'Mis vacantes | Top.com.do',
    description: 'Gestiona las ofertas de empleo que has publicado en Top.com.do.',
    canonical: `${SITE_URL}/empleos/mis-vacantes`,
    noindex: true,
  });

  const load = useCallback(() => {
    if (!user) return;
    api<JobDetail[]>('/me/jobs', { auth: true })
      .then(setJobs)
      .catch(() => setJobs([]));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent('/empleos/mis-vacantes')}`} replace />;
  }

  function openEdit(j: JobDetail) {
    setEditing(j);
    setForm(toForm(j));
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setError(null);
    setBusy(true);
    try {
      const status = editing.status === 'draft' ? 'draft' : 'published';
      await api(`/jobs/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...jobFormToPayload(form, 'published'), status }),
        auth: true,
      });
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function closeJob(id: string) {
    if (!window.confirm('¿Cerrar esta vacante? Dejará de aparecer en las búsquedas.')) return;
    try {
      await api(`/jobs/${id}`, { method: 'DELETE', auth: true });
      load();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Mis vacantes</h1>
        <Link to="/empleos/publicar" className="btn-gold shrink-0 whitespace-nowrap !py-2 text-xs">
          Publicar otra
        </Link>
      </header>

      {jobs === null ? (
        <Spinner />
      ) : !jobs.length ? (
        <div className="glass p-6 text-center text-sm text-white/55">
          Aún no has publicado vacantes.{' '}
          <Link to="/empleos/publicar" className="text-gold underline">
            Publica la primera gratis
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="glass space-y-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-white">💼 {j.title}</div>
                  <div className="truncate text-xs text-white/50">{j.companyName}</div>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/60">
                  {STATUS_LABEL[j.status] ?? j.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {j.status === 'published' && (
                  <Link to={`/empleo/${j.slug}`} className="btn-ghost !py-1 text-xs">
                    Ver
                  </Link>
                )}
                <button onClick={() => openEdit(j)} className="btn-ghost !py-1 text-xs">
                  Editar
                </button>
                {j.status !== 'closed' && (
                  <button
                    onClick={() => closeJob(j.id)}
                    className="btn-ghost !py-1 text-xs text-red-300"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title={`Editar · ${editing.title}`} onClose={() => setEditing(null)}>
          <JobForm
            value={form}
            onChange={setForm}
            onSubmit={saveEdit}
            submitLabel="Guardar cambios"
            busy={busy}
            error={error}
          />
        </Modal>
      )}
    </div>
  );
}
