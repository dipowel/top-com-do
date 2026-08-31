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
      <h3 className="font-bold">Ranking por ventana móvil (7 días)</h3>
      <p className="text-sm text-white/50">
        El ranking ya <strong className="text-white/70">no depende de rondas</strong>: el puesto de
        cada negocio es la suma de sus pujas verificadas de los últimos 7 días y se recalcula solo
        en tiempo real. No hace falta reiniciar nada.
      </p>
      <p className="text-xs text-white/40">
        El botón de abajo solo agrupa las pujas nuevas bajo una etiqueta distinta (auditoría). No
        borra ni pone a cero ningún ranking.
      </p>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="btn-ghost w-full">
          Crear nueva etiqueta de ronda…
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
