import { useState } from 'react';
import { api } from '../lib/api';

interface ResetResponse {
  previousChampion: { profile: { name: string } } | null;
}

export default function RoundsControl() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function reset() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<ResetResponse>('/admin/rounds/reset', { method: 'POST', auth: true });
      setMsg(`Nueva ronda creada. Campeón anterior: ${r.previousChampion?.profile.name ?? '—'}`);
      setConfirm(false);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass max-w-md space-y-3 p-4">
      <h3 className="font-bold">Reiniciar ronda semanal</h3>
      <p className="text-sm text-white/50">
        Cierra la ronda actual y abre una nueva desde el puesto #1. Las pujas verificadas anteriores
        quedan archivadas para auditoría.
      </p>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="btn-ghost w-full">
          Reiniciar ronda…
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={reset} disabled={busy} className="btn-gold flex-1">
            {busy ? 'Reiniciando…' : 'Confirmar reinicio'}
          </button>
          <button onClick={() => setConfirm(false)} className="btn-ghost">
            Cancelar
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-white/60">{msg}</p>}
    </div>
  );
}
