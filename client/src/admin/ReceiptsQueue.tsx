import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';

interface Row {
  bidId: string;
  amountDop: number;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  profileName: string;
  bidderEmail: string;
  bidderName: string | null;
  receiptUrl: string | null;
  receiptMime: string | null;
}

export default function ReceiptsQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Row[]>('/admin/receipts?status=pending', { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000); // refresca solo para ver pujas nuevas
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
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
      <p className="text-xs text-white/45">
        Pagos por transferencia pendientes. Aprueba cuando confirmes el dinero en la cuenta; el
        perfil sube al ranking al instante.
      </p>

      {!rows.length && <p className="text-sm text-white/50">No hay pagos pendientes. 🎉</p>}

      {rows.map((r) => {
        const isPdf = r.receiptMime === 'application/pdf';
        return (
          <div key={r.bidId} className="glass p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{r.profileName}</div>
                <div className="truncate text-xs text-white/40">
                  {r.bidderName ? `${r.bidderName} · ` : ''}
                  {r.bidderEmail}
                </div>
                <div className="truncate text-xs text-white/40">
                  {new Date(r.createdAt).toLocaleString('es-DO')}
                </div>
                <div className="mt-1 text-lg font-extrabold text-gold">{formatDOP(r.amountDop)}</div>
              </div>

              {r.receiptUrl ? (
                isPdf ? (
                  <a
                    href={r.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost shrink-0 !py-1.5 text-xs"
                  >
                    Ver PDF
                  </a>
                ) : (
                  <button onClick={() => setZoom(r.receiptUrl)} className="shrink-0">
                    <img
                      src={r.receiptUrl}
                      className="h-24 w-24 rounded-lg object-cover ring-1 ring-white/10"
                      alt="comprobante"
                    />
                  </button>
                )
              ) : (
                <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/40">
                  sin comprobante
                </span>
              )}
            </div>

            <div className="mt-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs">
              <span className="text-white/40">N.º de confirmación: </span>
              {r.reference ? (
                <span className="font-semibold tracking-wide">{r.reference}</span>
              ) : (
                <span className="text-white/40">no ingresado</span>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                disabled={busy === r.bidId}
                onClick={() => decide(r.bidId, 'verified')}
                className="btn-emerald flex-1 !py-2 text-xs"
              >
                Aprobar y publicar
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
        );
      })}

      {zoom && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} className="max-h-[90vh] max-w-full rounded-xl" alt="comprobante" />
        </div>
      )}
    </div>
  );
}
