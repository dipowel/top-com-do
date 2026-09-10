import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Modal from '../components/common/Modal';
import JobForm, {
  emptyJobForm,
  jobFormToPayload,
  type JobFormValue,
} from '../components/jobs/JobForm';
import { JOB_CATEGORY_DEFS } from '@shared/job-categories';
import type { JobDetail } from '@shared/types';

type SourcePlatform = 'csv' | 'greenhouse' | 'lever' | 'jooble';
const NEW_PLATFORMS: { v: SourcePlatform; label: string; type: string }[] = [
  { v: 'csv', label: 'CSV curado (URL)', type: 'feed' },
  { v: 'greenhouse', label: 'Greenhouse (ATS)', type: 'ats' },
  { v: 'lever', label: 'Lever (ATS)', type: 'ats' },
  { v: 'jooble', label: 'Jooble (API · requiere key)', type: 'api' },
];

interface JoobleQuery {
  keywords: string;
  location?: string;
}
interface SourceConfig {
  csvUrl?: string;
  greenhouseToken?: string | string[];
  leverHandle?: string | string[];
  companyName?: string;
  joobleQueries?: JoobleQuery[];
}

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
  indexingLastError: string | null;
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
  defaultCategory: string | null;
  feedUrl: string | null;
  config: SourceConfig | null;
  notes: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  activeJobs: number;
}

interface ImportStatus {
  enabled: boolean;
  schedule: string;
  cronSecretSet: boolean;
  joobleKeySet: boolean;
  googleIndexingSet: boolean;
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
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; form: JobFormValue } | null>(null);
  const [showNewSource, setShowNewSource] = useState(false);
  const [editSourceId, setEditSourceId] = useState<string | null>(null);

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
    api<{ jobsImport?: ImportStatus }>('/health/config')
      .then((h) => setImportStatus(h.jobsImport ?? null))
      .catch(() => {});
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

  async function reindex(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      const out = await api<{ ok: boolean; skipped?: boolean; error?: string }>(
        `/admin/jobs/${id}/reindex`,
        { method: 'POST', auth: true },
      );
      setMsg(
        out.ok
          ? 'URL reenviada a Google Indexing.'
          : out.skipped
            ? 'Falta configurar la Indexing API (GOOGLE_INDEXING_* en Vercel).'
            : `Google rechazó la notificación: ${out.error ?? 'error'}`,
      );
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

  async function patchSource(id: string, patch: Record<string, unknown>) {
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

  async function createSource(payload: Record<string, unknown>) {
    setBusy('new-source');
    setMsg(null);
    try {
      await api('/admin/job-sources', { method: 'POST', body: JSON.stringify(payload), auth: true });
      setShowNewSource(false);
      loadSources();
      setMsg('Fuente creada. Ponla en "authorized" + "activa" para que el cron la importe.');
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
                      {j.indexingStatus && (
                        <div
                          className={`text-[10px] ${j.indexingStatus === 'error' ? 'text-red-300' : 'text-white/30'}`}
                          title={j.indexingLastError ?? undefined}
                        >
                          idx: {j.indexingStatus}
                          {j.indexingStatus === 'error' && j.indexingLastError
                            ? ` — ${j.indexingLastError.slice(0, 50)}`
                            : ''}
                        </div>
                      )}
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
                        {j.status === 'published' && (
                          <button
                            onClick={() => reindex(j.id)}
                            disabled={busy === j.id}
                            className="rounded border border-white/20 px-2 py-0.5 text-[10px] text-white/60"
                            title="Re-notificar esta URL a la Google Indexing API"
                          >
                            ↻ Indexar
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
          {importStatus && !importStatus.enabled && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-200">
              La importación automática está <b>apagada</b>. Pon <code>IMPORT_ENABLED=true</code> en
              Vercel para que el cron ({importStatus.schedule} UTC) y el botón "Ejecutar importación"
              procesen fuentes.
              {!importStatus.cronSecretSet && ' Además falta CRON_SECRET (el cron responderá 401).'}
            </div>
          )}
          {importStatus?.enabled && (
            <div className="rounded-xl border border-emerald/25 bg-emerald/10 p-3 text-[11px] text-emerald-soft">
              Importación automática <b>activa</b> — el cron corre a las {importStatus.schedule} UTC.
            </div>
          )}
          {importStatus && !importStatus.googleIndexingSet && (
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-[11px] text-white/55">
              <b>Google Indexing API sin credenciales.</b> Las vacantes aprobadas se avisan a Bing
              (IndexNow) pero no a Google. Pon <code>GOOGLE_INDEXING_CLIENT_EMAIL</code> y{' '}
              <code>GOOGLE_INDEXING_PRIVATE_KEY</code> (cuenta de servicio, propietaria en Search
              Console) en Vercel. El disparo aprobar → Google ya está en el código.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={runImport} disabled={busy === 'import'} className="btn-gold text-xs">
              {busy === 'import' ? 'Importando…' : 'Ejecutar importación ahora'}
            </button>
            <button
              onClick={() => {
                setShowNewSource((v) => !v);
                setEditSourceId(null);
              }}
              className="btn-ghost text-xs"
            >
              {showNewSource ? 'Cancelar' : '＋ Nueva fuente'}
            </button>
          </div>

          {showNewSource && (
            <SourceForm
              busy={busy === 'new-source'}
              onCancel={() => setShowNewSource(false)}
              onSubmit={createSource}
            />
          )}

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
                  <Fragment key={s.id}>
                    <tr className="border-t border-white/5">
                      <td className="p-2">
                        <div className="font-semibold text-white/85">{s.name}</div>
                        <div className="text-[10px] text-white/35">
                          {s.platform} · {s.sourceType}
                          {s.platform !== 'direct' && (
                            <button
                              onClick={() => setEditSourceId(editSourceId === s.id ? null : s.id)}
                              className="ml-2 text-gold underline"
                            >
                              {editSourceId === s.id ? 'cerrar' : 'config'}
                            </button>
                          )}
                        </div>
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
                        <label className="text-[11px]" title="Si está apagado, las vacantes importadas entran como 'Nuevas' para tu aprobación.">
                          <input
                            type="checkbox"
                            checked={s.autoPublish}
                            onChange={(e) => patchSource(s.id, { autoPublish: e.target.checked })}
                          />{' '}
                          auto-publica
                        </label>
                      </td>
                    </tr>
                    {editSourceId === s.id && (
                      <tr className="border-t border-white/5 bg-white/[0.02]">
                        <td colSpan={5} className="p-2">
                          <SourceForm
                            initial={s}
                            busy={busy === s.id}
                            onCancel={() => setEditSourceId(null)}
                            onSubmit={(payload) => {
                              patchSource(s.id, payload);
                              setEditSourceId(null);
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-white/40">
            El campo "auto-publica" apagado = las vacantes importadas entran como "Nuevas" para tu
            aprobación (pestaña Vacantes). Los portales bloqueados (LinkedIn, Computrabajo, Tecoloco,
            Tu Nuevo Trabajo) solo se activan con feed/API/permiso legítimo.
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

function joobleQueriesToText(qs?: JoobleQuery[]): string {
  return (qs ?? [])
    .map((q) => (q.location ? `${q.keywords} | ${q.location}` : q.keywords))
    .join('\n');
}
function textToJoobleQueries(t: string): JoobleQuery[] {
  return t
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [kw, loc] = line.split('|').map((x) => x.trim());
      return loc ? { keywords: kw, location: loc } : { keywords: kw };
    });
}
function cfgListToText(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v.join(', ') : v ?? '';
}

/** Formulario compartido para crear una fuente nueva o editar el `config` de una existente. */
function SourceForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial?: SourceRow;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const isEdit = Boolean(initial);
  const [platform, setPlatform] = useState<SourcePlatform>(
    (initial?.platform as SourcePlatform) || 'csv',
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [defaultCategory, setDefaultCategory] = useState(initial?.defaultCategory ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const cfg = initial?.config ?? {};
  const [csvUrl, setCsvUrl] = useState(cfg.csvUrl ?? initial?.feedUrl ?? '');
  const [companyName, setCompanyName] = useState(cfg.companyName ?? '');
  const [greenhouseToken, setGreenhouseToken] = useState(cfgListToText(cfg.greenhouseToken));
  const [leverHandle, setLeverHandle] = useState(cfgListToText(cfg.leverHandle));
  const [jooble, setJooble] = useState(
    joobleQueriesToText(cfg.joobleQueries) || (initial ? '' : 'empleo'),
  );

  const canSubmit =
    (isEdit || name.trim().length > 1) &&
    ((platform === 'csv' && csvUrl.trim()) ||
      (platform === 'greenhouse' && greenhouseToken.trim()) ||
      (platform === 'lever' && leverHandle.trim()) ||
      (platform === 'jooble' && jooble.trim()));

  function submit() {
    const config: SourceConfig = {};
    if (platform === 'csv') config.csvUrl = csvUrl.trim();
    if (platform === 'greenhouse') {
      config.greenhouseToken = greenhouseToken.trim();
      if (companyName.trim()) config.companyName = companyName.trim();
    }
    if (platform === 'lever') {
      config.leverHandle = leverHandle.trim();
      if (companyName.trim()) config.companyName = companyName.trim();
    }
    if (platform === 'jooble') config.joobleQueries = textToJoobleQueries(jooble);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      config,
      defaultCategory: defaultCategory || null,
      notes: notes.trim() || null,
    };
    if (platform === 'csv') payload.feedUrl = csvUrl.trim() || null;
    if (!isEdit) {
      payload.platform = platform;
      payload.sourceType = NEW_PLATFORMS.find((p) => p.v === platform)?.type ?? 'feed';
    }
    onSubmit(payload);
  }

  return (
    <div className="glass space-y-2 p-3 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-white/40">Plataforma</span>
          <select
            className="input mt-1 w-full !py-1"
            value={platform}
            disabled={isEdit}
            onChange={(e) => setPlatform(e.target.value as SourcePlatform)}
          >
            {NEW_PLATFORMS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-white/40">Nombre visible</span>
          <input
            className="input mt-1 w-full !py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Vacantes curadas RD"
          />
        </label>
      </div>

      {platform === 'csv' && (
        <label className="block">
          <span className="text-white/40">URL del CSV (Google Sheet publicada como CSV, etc.)</span>
          <input
            className="input mt-1 w-full !py-1"
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/pub?output=csv"
          />
        </label>
      )}

      {platform === 'greenhouse' && (
        <>
          <label className="block">
            <span className="text-white/40">Board token(s) de Greenhouse — separa varios con coma</span>
            <input
              className="input mt-1 w-full !py-1"
              value={greenhouseToken}
              onChange={(e) => setGreenhouseToken(e.target.value)}
              placeholder="acme, globex"
            />
          </label>
          <label className="block">
            <span className="text-white/40">Nombre del empleador (opcional si son varios)</span>
            <input
              className="input mt-1 w-full !py-1"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>
        </>
      )}

      {platform === 'lever' && (
        <>
          <label className="block">
            <span className="text-white/40">Company handle(s) de Lever — separa varios con coma</span>
            <input
              className="input mt-1 w-full !py-1"
              value={leverHandle}
              onChange={(e) => setLeverHandle(e.target.value)}
              placeholder="acme, globex"
            />
          </label>
          <label className="block">
            <span className="text-white/40">Nombre del empleador (opcional si son varios)</span>
            <input
              className="input mt-1 w-full !py-1"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>
        </>
      )}

      {platform === 'jooble' && (
        <label className="block">
          <span className="text-white/40">
            Búsquedas (una por línea; <code>palabras</code> o <code>palabras | ubicación</code>).
            Si omites la ubicación, se usa "República Dominicana".
          </span>
          <textarea
            className="input mt-1 w-full !py-1"
            rows={3}
            value={jooble}
            onChange={(e) => setJooble(e.target.value)}
            placeholder={'desarrollador\nventas\ncontabilidad\natención al cliente'}
          />
          <span className="mt-1 block text-[10px] text-white/35">
            Jooble consulta el índice de RD, filtra a República Dominicana automáticamente y sus
            vacantes <b>siempre entran a revisión manual</b> (el toggle "auto-publica" no aplica).
            Requiere <code>JOOBLE_API_KEY</code> en el servidor.
          </span>
        </label>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-white/40">Categoría por defecto</span>
          <select
            className="input mt-1 w-full !py-1"
            value={defaultCategory}
            onChange={(e) => setDefaultCategory(e.target.value)}
          >
            <option value="">(auto / sin asignar)</option>
            {JOB_CATEGORY_DEFS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-white/40">Notas internas</span>
          <input
            className="input mt-1 w-full !py-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={busy || !canSubmit} className="btn-gold text-xs">
          {busy ? 'Guardando…' : isEdit ? 'Guardar config' : 'Crear fuente'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-xs">
          Cancelar
        </button>
      </div>
      {!isEdit && (
        <p className="text-[11px] text-white/35">
          Nace con <b>auto-publica apagado</b>: lo importado entra como "Nuevas" para tu aprobación.
          Actívala y ponla en "authorized" en la tabla de abajo.
        </p>
      )}
    </div>
  );
}
