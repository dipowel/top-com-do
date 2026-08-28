import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';

interface Row {
  id: string;
  status: 'pending' | 'eligible' | 'approved' | 'rejected';
  bonusDop: number;
  createdAt: string;
  approvedAt: string | null;
  referrerEmail: string | null;
  referrerName: string | null;
  referredEmail: string | null;
  referredName: string | null;
  verifiedBids: number;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Sin puja válida', cls: 'bg-white/10 text-white/50' },
  eligible: { label: 'Listo para liberar', cls: 'bg-amber-400/15 text-amber-300' },
  approved: { label: 'Bono acreditado', cls: 'bg-emerald/15 text-emerald-soft' },
  rejected: { label: 'Rechazado', cls: 'bg-red-400/15 text-red-300' },
};

export default function ReferralsQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Row[]>('/admin/referrals', { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      await api(`/admin/referrals/${id}/${action}`, { method: 'POST', auth: true });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">
        El bono <b>nunca</b> se acredita solo. Primero aprueba la puja del invitado en “Pagos por
        revisar”; luego libera aquí los RD$ 100 al referente.
      </p>

      {!rows.length && <p className="text-sm text-white/50">Todavía no hay referidos.</p>}

      {rows.map((r) => (
        <div key={r.id} className="glass p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div>
                <span className="text-white/40">Invita: </span>
                <b>{r.referrerName || r.referrerEmail}</b>
              </div>
              <div>
                <span className="text-white/40">Invitado: </span>
                {r.referredName || r.referredEmail}
              </div>
              <div className="mt-0.5 text-[11px] text-white/40">
                {r.verifiedBids} puja(s) válida(s) verificada(s) · {new Date(r.createdAt).toLocaleDateString('es-DO')}
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[r.status]?.cls}`}>
              {STATUS[r.status]?.label}
            </span>
          </div>

          {(r.status === 'eligible' || r.status === 'pending') && (
            <div className="mt-3 flex gap-2">
              <button
                disabled={busy === r.id || r.status !== 'eligible'}
                onClick={() => decide(r.id, 'approve')}
                className="btn-emerald flex-1 !py-2 text-xs"
              >
                Liberar bono {formatDOP(r.bonusDop)}
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => decide(r.id, 'reject')}
                className="btn-ghost flex-1 !py-2 text-xs"
              >
                Rechazar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
