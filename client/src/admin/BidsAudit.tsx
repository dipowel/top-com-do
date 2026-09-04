import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';
import EditBidModal from './EditBidModal';

interface Row {
  id: string;
  amountDop: number;
  method: string;
  status: string;
  createdAt: string;
  profileId: string;
  profileName: string;
  province: string | null;
  city: string | null;
  address: string | null;
  userId: string;
  bidderEmail: string;
}

const FILTERS = ['', 'pending', 'verified', 'rejected'];
const METHOD: Record<string, string> = {
  dodo: 'Dodo Payments',
  credit: 'Saldo',
  bank_transfer: 'Transferencia',
  paypal: 'PayPal',
};

export default function BidsAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);

  const load = useCallback(() => {
    api<Row[]>(`/admin/bids${status ? `?status=${status}` : ''}`, { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function verify(id: string, next: 'verified' | 'rejected') {
    setBusy(id);
    try {
      await api(`/admin/bids/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status: next }),
        auth: true,
      });
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reconcileDodo() {
    setBusy('reconcile');
    setMsg(null);
    try {
      const r = await api<{ checked: number; fulfilled: string[] }>('/checkout/dodo/reconcile', {
        method: 'POST',
        auth: true,
      });
      setMsg(`Revisadas ${r.checked} · acreditadas ${r.fulfilled.length}`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === s ? 'border-gold/50 text-gold' : 'border-white/10 text-white/50'
            }`}
          >
            {s || 'Todas'}
          </button>
        ))}
        <button
          onClick={reconcileDodo}
          disabled={busy === 'reconcile'}
          className="btn-ghost ml-auto !py-1 text-xs"
        >
          {busy === 'reconcile' ? 'Reconciliando…' : '🔄 Reconciliar pagos Dodo'}
        </button>
      </div>

      {msg && <p className="mb-2 text-xs text-white/60">{msg}</p>}

      <div className="glass overflow-x-auto p-1">
        <table className="w-full text-left text-xs">
          <thead className="text-white/40">
            <tr>
              <th className="p-2">Fecha</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Usuario</th>
              <th className="p-2">Método</th>
              <th className="p-2">Monto</th>
              <th className="p-2">Estado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="p-2">{new Date(b.createdAt).toLocaleDateString('es-DO')}</td>
                <td className="p-2">{b.profileName}</td>
                <td className="p-2">{b.bidderEmail}</td>
                <td className="p-2">{METHOD[b.method] ?? b.method}</td>
                <td className="p-2 font-bold">{formatDOP(b.amountDop)}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2">
                  <span className="flex flex-wrap gap-1">
                    {b.status === 'pending' && (
                      <>
                        <button
                          onClick={() => verify(b.id, 'verified')}
                          disabled={busy === b.id}
                          className="rounded border border-emerald/40 px-2 py-0.5 text-[10px] text-emerald-soft"
                        >
                          Verificar
                        </button>
                        <button
                          onClick={() => verify(b.id, 'rejected')}
                          disabled={busy === b.id}
                          className="rounded border border-red-400/40 px-2 py-0.5 text-[10px] text-red-300"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setEditing(b)}
                      className="rounded border border-gold/40 px-2 py-0.5 text-[10px] text-gold"
                    >
                      ✎ Editar
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditBidModal
          bid={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
