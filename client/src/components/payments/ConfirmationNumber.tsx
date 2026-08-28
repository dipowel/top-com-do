import { useState } from 'react';
import { api } from '../../lib/api';

export default function ConfirmationNumber({ bidId, onDone }: { bidId: string; onDone?: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value.trim().length < 3) {
      setError('Escribe el número de confirmación');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/bids/${bidId}/confirmation`, {
        method: 'POST',
        body: JSON.stringify({ reference: value.trim() }),
        auth: true,
      });
      setOk(true);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="text-xs text-white/50">Número de confirmación de la transferencia</label>
      <div className="mt-1 flex gap-2">
        <input
          className="input"
          placeholder="Ej. 0057293841"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={ok}
        />
        <button onClick={save} disabled={busy || ok} className={ok ? 'btn-emerald shrink-0' : 'btn-ghost shrink-0'}>
          {ok ? '✓' : busy ? '…' : 'Guardar'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
