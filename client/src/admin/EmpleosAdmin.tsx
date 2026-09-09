import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Modal from '../components/common/Modal';
import JobForm, {
  emptyJobForm,
  jobFormToPayload,
  type JobFormValue,
} from '../components/jobs/JobForm';
import type { JobDetail } from '@shared/types';

type View = 'jobs' | 'sources' | 'runs';

const STATUS_FILTERS = [
  { v: '', label: 'Todas' },
  { v: 'pending_review', label: 'Nuevas' },
  { v: 'possible_duplicate', label: 'Duplicadas' },
  { v: 'published', label: 'Publicadas' },
  { v: 'expired', label: 'Expiradas' },
  { v: 'removed', label: 'Removidas' },
  { v: 'closed', label: 'Cerradas' },
];

interface AdminJobRow {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  categoryName: string;
  provinceName: string | null;
  status: string;
  sourcePlatform: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  applicationUrl: string | null;
  duplicateOfId: string | null;
  indexingStatus: string | null;
  updatedAt: string;
  firstSeenAt: string;
}

interface SourceRow {
  id: string;
  platform: string;
  name: string;
  sourceType: string;
  isEnabled: boolean;
  autoPublish: boolean;
  authorizationStatus: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  activeJobs: number;
}

interface RunRow {
  id: string;
  sourcePlatform: string;
  status: string;
  jobsFound: number;
  jobsNew: number;
  jobsUpdated: number;
  jobsDuplicate: number;
  jobsRemoved: number;
  jobsFailed: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

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
    streetAddress: j.streetAddress ?? '',
    postalCode: j.postalCode ?? '',
    jobType: j.jobType,
    workMode: j.workMode,
    salaryMin: j.salaryMin != null ? String(j.salaryMin) : '',
    salaryMax: j.salaryMax != null ? String(j.salaryMax) : '',
    salaryCurrency: j.salaryCurrency || 'DOP',
    salaryPeriod: j.salaryPeriod ?? '',
    applicationUrl: j.applicationUrl ?? '',
    applicationEmail: j.applicationEmail ?? '',
    contactWhatsapp: j.contactWhatsapp ?? '',
    expiresAt: j.expiresAt ? j.expiresAt.slice(0, 10) : '',
  };
}

export default function EmpleosAdmin() {
  const [view, setView] = useState<View>('jobs');
  const [status, setStatus] = useState('pending_review');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminJobRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; form: JobFormValue } | null>(null);

  const loadJobs = useCallback(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (source) p.set('source', source);
    if (q.trim()) p.set('q', q.trim());
    api<AdminJobRow[]>(`/admin/jobs?${p}`, { auth: true })
      .then(setRows)
      .catch((e) => setMsg((e as Error).message));
  }, [status, source, q]);

  const loadSources = useCallback(() => {
    api<SourceRow[]>('/admin/job-sources', { auth: true }).then(setSources).catch(() => {});
  }, []);
  const loadRuns = useCallback(() => {
    api<RunRow[]>('/admin/job-import-runs', { auth: true }).then(setRuns).catch(() => {});
  }, []);

  useEffect(() => {
    if (view === 'jobs') loadJobs();
    if (view === 'sources') loadSources();
    if (view === 'runs') loadRuns();
  }, [view, loadJobs, loadSources, loadRuns]);

  async function act(id: string, action: string) {
    setBusy(id);
    setMsg(null);
    try {
      await api(`/admin/jobs/${id}/${action}`, { method: 'POST', auth: true });
      loadJobs();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function openEdit(id: string) {
    setBusy(id);
    try {
      const j = await api<JobDetail>(`/admin/jobs/${id}`, { auth: true }).catch(() => null);
      if (j) setEditing({ id, form: toForm(j) });
      else setMsg('No se pudo cargar el detalle para editar.');
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(editing.id);
    try {
      await api(`/admin/jobs/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(jobFormToPayload(editing.form, 'published')),
        auth: true,
      });
      setEditing(null);
      loadJobs();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function patchSource(id: string, patch: Partial<SourceRow>) {
    setBusy(id);
    try {
      await api(`/admin/job-sources/${id}`, { method: 'PATCH', body: JSON.stringify(patch), auth: true });
      loadSources();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    setBusy('import');
    setMsg('Importando…');
    try {
      const out = await api<{ runs: unknown[] }>('/admin/jobs/import', { method: 'POST', auth: true });
      setMsg(`Importación: ${out.runs.length} fuente(s) procesada(s).`);
      loadSources();
      loadRuns();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['jobs', 'sources', 'runs'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              view === v ? 'border-gold/50 text-gold' : 'border-white/10 text-white/50'
            }`}
          >
            {v === 'jobs' ? 'Vacantes' : v === 'sources' ? 'Fuentes' : 'Corridas'}
          </button>
        ))}
      </div>

      {msg && <p className="mb-2 text-xs text-white/60">{msg}</p>}

      {view === 'jobs' && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.v}
                onClick={() => setStatus(f.v)}
                className={`rounded-full border px-3 py-1 text-[11px] ${
                  status === f.v ? 'border-gold/50 text-gold' : 'border-white/10 text-white/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar título o empresa…"
              className="input flex-1"
            />
            <select className="input w-40" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Toda fuente</option>
              <option value="direct">Directa</option>
              {sources.map((s) => (
                <option key={s.platform} value={s.platform}>
                  {s.name}
                </option>
              ))}
            </select>
            <button onClick={loadJobs} className="btn-ghost text-xs">
              Buscar
            </button>
          </div>

          <div className="glass overflow-x-auto p-1">
            <table className="w-full text-left text-xs">
              <thead className="text-white/40">
                <tr>
                  <th className="p-2">Vacante</th>
                  <th className="p-2">Cat. / Prov.</th>
                  <th className="p-2">Fuente</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Actualizada</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.id} className="border-t border-white/5 align-top">
                    <td className="p-2">
                      <Link to={`/empleo/${j.slug}`} className="font-semibold text-white/85 hover:text-gold">
                        {j.title}
                      </Link>
                      <div className="text-[10px] text-white/35">{j.companyName}</div>
                      {j.duplicateOfId && <div className="text-[10px] text-amber-300">posible duplicado</div>}
                    </td>
                    <td className="p-2">
                      {j.categoryName}
                      <div className="text-[10px] text-white/35">{j.provinceName ?? '—'}</div>
                    </td>
                    <td className="p-2">
                      {j.sourceName ?? j.sourcePlatform ?? 'directa'}
                      {j.sourceUrl && (
                        <a href={j.sourceUrl} target="_blank" rel="noreferrer" className="block text-[10px] text-white/35 underline">
                          origen
                        </a>
                      )}
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          j.status === 'published'
                            ? 'text-emerald-soft'
                            : j.status === 'pending_review'
                              ? 'text-amber-300'
                              : 'text-white/45'
                        }
                      >
                        {j.status}
                      </span>
                      {j.indexingStatus && <div className="text-[10px] text-white/30">idx: {j.indexingStatus}</div>}
                    </td>
                    <td className="p-2">{new Date(j.updatedAt).toLocaleDateString('es-DO')}</td>
                    <td className="p-2">
                      <span className="flex flex-wrap gap-1">
                        {j.status !== 'published' && (
                          <button
                            onClick={() => act(j.id, j.duplicateOfId ? 'not-duplicate' : 'approve')}
                            disabled={busy === j.id}
                            className="rounded border border-emerald/40 px-2 py-0.5 text-[10px] text-emerald-soft"
                          >
                            ✅ {j.duplicateOfId ? 'No es dup.' : 'Aprobar'}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(j.id)}
                          disabled={busy === j.id}
                          className="rounded border border-gold/40 px-2 py-0.5 text-[10px] text-gold"
                        >
                          ✎ Editar
                        </button>
                        {j.sourcePlatform && j.sourcePlatform !== 'direct' && (
                          <button
                            onClick={() => act(j.id, 'reimport')}
                            disabled={busy === j.id}
                            className="rounded border border-white/20 px-2 py-0.5 text-[10px] text-white/60"
                          >
                            ↻ Reimportar
                          </button>
                        )}
                        {j.status !== 'removed' && (
                          <button
                            onClick={() => act(j.id, 'reject')}
                            disabled={busy === j.id}
                            className="rounded border border-red-400/40 px-2 py-0.5 text-[10px] text-red-300"
                          >
                            🚫 Rechazar
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p className="mt-3 text-sm text-white/50">Sin vacantes en este filtro.</p>}
        </>
      )}

      {view === 'sources' && (
        <div className="space-y-3">
          <button onClick={runImport} disabled={busy === 'import'} className="btn-gold text-xs">
            {busy === 'import' ? 'Importando…' : 'Ejecutar importación ahora'}
          </button>
          <div className="glass overflow-x-auto p-1">
            <table className="w-full text-left text-xs">
              <thead className="text-white/40">
                <tr>
                  <th className="p-2">Fuente</th>
                  <th className="p-2">Autorización</th>
                  <th className="p-2">Activas</th>
                  <th className="p-2">Última corrida</th>
                  <th className="p-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="p-2">
                      <div className="font-semibold text-white/85">{s.name}</div>
                      <div className="text-[10px] text-white/35">{s.platform} · {s.sourceType}</div>
                    </td>
                    <td className="p-2">
                      <select
                        className="input !py-1 text-[11px]"
                        value={s.authorizationStatus}
                        disabled={s.platform === 'direct'}
                        onChange={(e) => patchSource(s.id, { authorizationStatus: e.target.value })}
                      >
                        {['none', 'requested', 'authorized', 'denied'].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">{s.activeJobs}</td>
                    <td className="p-2">
                      {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString('es-DO') : '—'}
                      {s.lastError && <div className="text-[10px] text-red-300">{s.lastError.slice(0, 60)}</div>}
                    </td>
                    <td className="p-2">
                      <label className="mr-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={s.isEnabled}
                          disabled={s.platform === 'direct'}
                          onChange={(e) => patchSource(s.id, { isEnabled: e.target.checked })}
                        />{' '}
                        activa
                      </label>
                      <label className="text-[11px]">
                        <input
                          type="checkbox"
                          checked={s.autoPublish}
                          onChange={(e) => patchSource(s.id, { autoPublish: e.target.checked })}
                        />{' '}
                        auto-publica
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-white/40">
            Los portales bloqueados (LinkedIn, Computrabajo, Tecoloco, Tu Nuevo Trabajo) solo se pueden
            activar con un feed/API/permiso legítimo; sin él, la importación lanza error controlado.
          </p>
        </div>
      )}

      {view === 'runs' && (
        <div className="glass overflow-x-auto p-1">
          <table className="w-full text-left text-xs">
            <thead className="text-white/40">
              <tr>
                <th className="p-2">Fuente</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Encontradas</th>
                <th className="p-2">Nuevas / Act. / Dup. / Rem. / Fallos</th>
                <th className="p-2">Inicio</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="p-2">{r.sourcePlatform}</td>
                  <td className={`p-2 ${r.status === 'error' ? 'text-red-300' : 'text-emerald-soft'}`}>{r.status}</td>
                  <td className="p-2">{r.jobsFound}</td>
                  <td className="p-2">
                    {r.jobsNew} / {r.jobsUpdated} / {r.jobsDuplicate} / {r.jobsRemoved} / {r.jobsFailed}
                    {r.error && <div className="text-[10px] text-red-300">{r.error.slice(0, 80)}</div>}
                  </td>
                  <td className="p-2">{new Date(r.startedAt).toLocaleString('es-DO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!runs.length && <p className="mt-3 text-sm text-white/50">Aún no hay corridas de importación.</p>}
        </div>
      )}

      {editing && (
        <Modal title="Editar vacante" onClose={() => setEditing(null)}>
          <JobForm
            value={editing.form}
            onChange={(form) => setEditing({ ...editing, form })}
            onSubmit={saveEdit}
            submitLabel="Guardar cambios"
            busy={busy === editing.id}
          />
        </Modal>
      )}
    </div>
  );
}
