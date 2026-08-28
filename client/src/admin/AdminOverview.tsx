import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';

interface Overview {
  round: { weekStart: string; weekEnd: string };
  pendingCount: number;
  verifiedTotal: number;
  eligibleReferrals: number;
}

export default function AdminOverview() {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>('/admin/overview', { auth: true })
      .then(setD)
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <div className="glass p-3 text-xs text-red-300">{err}</div>;
  if (!d) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="glass p-4">
        <div className="text-xs text-white/40">Pagos por revisar</div>
        <div className="text-2xl font-black text-gold">{d.pendingCount}</div>
      </div>
      <div className="glass p-4">
        <div className="text-xs text-white/40">Bonos de referido por liberar</div>
        <div className="text-2xl font-black text-amber-300">{d.eligibleReferrals}</div>
      </div>
      <div className="glass p-4">
        <div className="text-xs text-white/40">Recaudado (ronda activa)</div>
        <div className="text-2xl font-black">{formatDOP(d.verifiedTotal)}</div>
      </div>
      <div className="glass p-4">
        <div className="text-xs text-white/40">Ronda desde</div>
        <div className="text-sm font-bold">
          {new Date(d.round.weekStart).toLocaleDateString('es-DO')}
        </div>
      </div>
    </div>
  );
}
