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

const FILTERS: Array<{ v: string; label: string }> = [
  { v: 'pending', label: 'Por revisar' },
  { v: 'approved', label: 'Aprobados' },
  { v: 'rejected', label: 'Rechazados' },
];

export default function PlansQueue() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [prices, setPrices] = useState({ planVerificadoPriceDop: 500, planDestacadoPriceDop: 1500 });
  const [slots, setSlots] = useState<FeaturedSlotRow[]>([]);

  const load = useCallback(() => {
    api<Row[]>(`/admin/plan-payments?status=${status}`, { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<typeof prices>('/admin/settings', { auth: true }).then(setPrices).catch(() => {});
    api<FeaturedSlotRow[]>('/admin/featured-slots', { auth: true }).then(setSlots).catch(() => setSlots([]));
  }, []);

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
    </div>
  );
}
