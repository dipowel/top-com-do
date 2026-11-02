import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';

interface Row {
  id: string;
  plan: 'verificado' | 'destacado';
  amountDop: number;
  status: 'pending' | 'approved' | 'rejected';
  reference: string | null;
  proofDataUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  profileId: string;
  profileName: string;
  requesterEmail: string | null;
}

interface FeaturedSlotRow {
  id: string;
  province: string;
  endsAt: string;
  profileId: string;
  profileName: string;
  categoryName: string;
}

interface JobUrgentRow {
  id: string;
  amountDop: number;
  status: 'pending' | 'approved' | 'rejected';
  reference: string | null;
  proofDataUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  jobId: string;
  jobTitle: string;
  requesterEmail: string | null;
}

interface WhatsappAlertRow {
  id: string;
  phone: string;
  keywords: string | null;
  zone: string | null;
  active: boolean;
  createdAt: string;
}

const FILTERS: Array<{ v: string; label: string }> = [
  { v: 'pending', label: 'Por revisar' },
  { v: 'approved', label: 'Aprobados' },
  { v: 'rejected', label: 'Rechazados' },
];

export default function PlansQueue() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [prices, setPrices] = useState({ planVerificadoPriceDop: 500, planDestacadoPriceDop: 1500, jobUrgentPriceDop: 500 });
  const [slots, setSlots] = useState<FeaturedSlotRow[]>([]);
  const [urgentRows, setUrgentRows] = useState<JobUrgentRow[]>([]);
  const [urgentBusy, setUrgentBusy] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<WhatsappAlertRow[]>([]);

  const load = useCallback(() => {
    api<Row[]>(`/admin/plan-payments?status=${status}`, { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
    api<JobUrgentRow[]>(`/admin/job-urgent-payments?status=${status}`, { auth: true })
      .then(setUrgentRows)
      .catch(() => setUrgentRows([]));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<typeof prices>('/admin/settings', { auth: true }).then(setPrices).catch(() => {});
    api<FeaturedSlotRow[]>('/admin/featured-slots', { auth: true }).then(setSlots).catch(() => setSlots([]));
    api<WhatsappAlertRow[]>('/admin/whatsapp-alerts', { auth: true }).then(setAlerts).catch(() => setAlerts([]));
  }, []);

  async function decideUrgent(id: string, action: 'approve' | 'reject') {
    setUrgentBusy(id);
    try {
      const reason = action === 'reject' ? prompt('¿Por qué se rechaza? (opcional)') ?? '' : undefined;
      await api(`/admin/job-urgent-payments/${id}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
        auth: true,
      });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUrgentBusy(null);
    }
  }

  function downloadAlertsCsv() {
    const header = 'telefono,palabras_clave,zona,activo,creado\n';
    const body = alerts
      .map((a) => [a.phone, a.keywords ?? '', a.zone ?? '', a.active ? 'si' : 'no', a.createdAt].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alertas-empleo.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      const reason = action === 'reject' ? prompt('¿Por qué se rechaza? (opcional)') ?? '' : undefined;
      await api(`/admin/plan-payments/${id}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
        auth: true,
      });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function savePrices() {
    try {
      await api('/admin/settings', { method: 'PATCH', body: JSON.stringify(prices), auth: true });
      alert('Precios actualizados');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass space-y-2 p-3">
        <div className="text-xs font-semibold text-white/60">Precios mensuales (RD$)</div>
        <div className="flex gap-2">
          <input
            type="number"
            value={prices.planVerificadoPriceDop}
            onChange={(e) => setPrices((p) => ({ ...p, planVerificadoPriceDop: Number(e.target.value) }))}
            className="input"
            placeholder="Verificado"
          />
          <input
            type="number"
            value={prices.planDestacadoPriceDop}
            onChange={(e) => setPrices((p) => ({ ...p, planDestacadoPriceDop: Number(e.target.value) }))}
            className="input"
            placeholder="Destacado"
          />
          <input
            type="number"
            value={prices.jobUrgentPriceDop}
            onChange={(e) => setPrices((p) => ({ ...p, jobUrgentPriceDop: Number(e.target.value) }))}
            className="input"
            placeholder="Vacante urgente"
          />
          <button onClick={savePrices} className="btn-gold shrink-0 !px-3 text-xs">
            Guardar
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setStatus(f.v)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              status === f.v ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 text-white/55'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!rows.length && <p className="text-sm text-white/50">Sin pagos aquí.</p>}

      {rows.map((r) => (
        <div key={r.id} className="glass p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div>
                <b>{r.profileName}</b> · plan {r.plan} · {formatDOP(r.amountDop)}
              </div>
              <div className="text-[11px] text-white/40">
                {r.requesterEmail} · ref: {r.reference || '(sin referencia)'} ·{' '}
                {new Date(r.createdAt).toLocaleDateString('es-DO')}
              </div>
              {r.rejectionReason && <div className="text-[11px] text-red-300">Motivo: {r.rejectionReason}</div>}
            </div>
            {r.proofDataUrl && (
              <a href={r.proofDataUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] text-gold underline">
                Ver comprobante
              </a>
            )}
          </div>
          {r.status === 'pending' && (
            <div className="mt-2 flex gap-2">
              <button disabled={busy === r.id} onClick={() => decide(r.id, 'approve')} className="btn-emerald flex-1 !py-2 text-xs">
                Aprobar
              </button>
              <button disabled={busy === r.id} onClick={() => decide(r.id, 'reject')} className="btn-ghost flex-1 !py-2 text-xs">
                Rechazar
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="glass space-y-2 p-3">
        <div className="text-xs font-semibold text-white/60">Espacios Destacado activos</div>
        {!slots.length && <p className="text-xs text-white/40">Ninguno activo ahora mismo.</p>}
        {slots.map((s) => (
          <div key={s.id} className="flex justify-between text-xs text-white/60">
            <span>
              {s.profileName} · {s.categoryName} · {s.province}
            </span>
            <span className="text-white/40">hasta {new Date(s.endsAt).toLocaleDateString('es-DO')}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-white">🔥 Vacantes urgentes</h2>
        {!urgentRows.length && <p className="text-sm text-white/50">Sin pagos aquí.</p>}
        {urgentRows.map((r) => (
          <div key={r.id} className="glass p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div>
                  <b>{r.jobTitle}</b> · {formatDOP(r.amountDop)}
                </div>
                <div className="text-[11px] text-white/40">
                  {r.requesterEmail} · ref: {r.reference || '(sin referencia)'} ·{' '}
                  {new Date(r.createdAt).toLocaleDateString('es-DO')}
                </div>
                {r.rejectionReason && <div className="text-[11px] text-red-300">Motivo: {r.rejectionReason}</div>}
              </div>
              {r.proofDataUrl && (
                <a href={r.proofDataUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] text-gold underline">
                  Ver comprobante
                </a>
              )}
            </div>
            {r.status === 'pending' && (
              <div className="mt-2 flex gap-2">
                <button disabled={urgentBusy === r.id} onClick={() => decideUrgent(r.id, 'approve')} className="btn-emerald flex-1 !py-2 text-xs">
                  Aprobar
                </button>
                <button disabled={urgentBusy === r.id} onClick={() => decideUrgent(r.id, 'reject')} className="btn-ghost flex-1 !py-2 text-xs">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="glass space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/60">📲 Suscriptores de alertas ({alerts.length})</div>
          {alerts.length > 0 && (
            <button onClick={downloadAlertsCsv} className="btn-ghost !px-2 !py-1 text-[11px]">
              Descargar CSV
            </button>
          )}
        </div>
        {!alerts.length && <p className="text-xs text-white/40">Nadie se ha suscrito todavía.</p>}
      </div>
    </div>
  );
}
