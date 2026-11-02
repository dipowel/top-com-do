import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDOP } from '../../lib/format';
import { fileToReceiptDataUrl } from '../../lib/image';
import Modal from '../common/Modal';
import type { JobDetail } from '@shared/types';

interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  instructions: string | null;
}
interface PricesResponse {
  prices: { jobUrgente: number };
  bankAccounts: BankAccount[];
}

/** "Vacante urgente · RD$500 · 7 días" — mismo flujo de comprobante por transferencia que
 *  los planes de negocio, pero ligado a UNA vacante. */
export default function UrgentJobModal({
  job,
  onClose,
  onSent,
}: {
  job: JobDetail;
  onClose: () => void;
  onSent: () => void;
}) {
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api<PricesResponse>('/plans/prices').then((p) => {
      setPrices(p);
      if (p.bankAccounts[0]) setBankAccountId(p.bankAccounts[0].id);
    });
  }, []);

  async function onFile(file: File) {
    try {
      setProofDataUrl(await fileToReceiptDataUrl(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/jobs/${job.id}/urgent-request`, {
        method: 'POST',
        body: JSON.stringify({ bankAccountId: bankAccountId || undefined, reference: reference || undefined, proofDataUrl: proofDataUrl || undefined }),
        auth: true,
      });
      setOk(true);
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="🔥 Hacer vacante urgente" onClose={onClose}>
      {ok ? (
        <div className="space-y-3 py-4 text-center text-sm">
          <p className="text-emerald-soft">✓ Pago enviado — queda pendiente de revisión.</p>
          <button onClick={onClose} className="btn-gold w-full">
            Listo
          </button>
        </div>
      ) : !prices ? (
        <p className="text-sm text-white/50">Cargando…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            {formatDOP(prices.prices.jobUrgente)} · se destaca con la etiqueta 🔥 URGENTE durante 7 días.
          </p>

          {prices.bankAccounts.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-white/50">Transfiere a:</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="input">
                {prices.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} · {b.accountHolder} · {b.accountNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-white/50">Número de referencia</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="input mt-1" />
          </div>

          <div>
            <label className="text-xs text-white/50">Foto o PDF del comprobante</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="mt-1 block w-full text-xs text-white/60"
            />
            {proofDataUrl && <p className="mt-1 text-[11px] text-emerald-soft">✓ Comprobante listo</p>}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button onClick={submit} disabled={busy} className="btn-gold w-full !py-2.5 text-xs">
            {busy ? 'Enviando…' : 'Enviar pago'}
          </button>
        </div>
      )}
    </Modal>
  );
}
