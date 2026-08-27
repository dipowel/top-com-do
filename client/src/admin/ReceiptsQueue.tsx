import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';

interface Row {
  bidId: string;
  amountDop: number;
  method: string;
  reference: string | null;
  createdAt: string;
  profileName: string;
  bidderEmail: string;
  receiptUrl: string | null;
  receiptMime: string | null;
}

export default function ReceiptsQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Row[]>('/admin/receipts?status=pending', { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(bidId: string, status: 'verified' | 'rejected') {
    setBusy(bidId);
    try {
      await api(`/admin/bids/${bidId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status }),
        auth: true,
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {!rows.length && <p className="text-sm text-white/50">No hay comprobantes pendientes. 🎉</p>}
      {rows.map((r) => (
        <div key={r.bidId} className="glass p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">{r.profileName}</div>
              <div className="truncate text-xs text-white/40">
                {r.bidderEmail} · {new Date(r.createdAt).toLocaleString('es-DO')}
              </div>
              <div className="mt-1 text-sm font-bold text-gold">{formatDOP(r.amountDop)}</div>
              {r.reference && <div className="text-xs text-white/40">Ref: {r.reference}</div>}
            </div>
            {r.receiptUrl &&
              (r.receiptMime === 'application/pdf' ? (
                <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 text-xs">
                  Ver PDF
                </a>
              ) : (
                <a href={r.receiptUrl} target="_blank" rel="noreferrer">
                  <img src={r.receiptUrl} className="h-24 w-24 rounded-lg object-cover" alt="comprobante" />
                </a>
              ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy === r.bidId}
              onClick={() => decide(r.bidId, 'verified')}
              className="btn-emerald flex-1 !py-2 text-xs"
            >
              Aprobar
            </button>
            <button
              disabled={busy === r.bidId}
              onClick={() => decide(r.bidId, 'rejected')}
              className="btn-ghost flex-1 !py-2 text-xs"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
