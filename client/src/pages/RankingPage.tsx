import { useState } from 'react';
import CategoryTabs from '../components/ranking/CategoryTabs';
import LeaderCard from '../components/ranking/LeaderCard';
import Spinner from '../components/common/Spinner';
import { useRankings } from '../hooks/useRankings';
import { useShell } from '../hooks/useShell';

export default function RankingPage() {
  const [cat, setCat] = useState('todo-rd');
  const { data, loading, error } = useRankings(cat);
  const { openBid } = useShell();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Ranking de visibilidad</h1>
        <p className="text-xs text-white/45">
          Datos en vivo desde la base de datos · se actualiza solo
        </p>
      </div>

      <CategoryTabs value={cat} onChange={setCat} />

      {loading && !data.length && <Spinner />}
      {error && (
        <div className="glass p-3 text-xs text-red-300">No se pudo cargar el ranking: {error}</div>
      )}
      {!loading && !data.length && !error && (
        <div className="glass space-y-3 p-6 text-center text-sm text-white/50">
          <p>Aún no hay pujas activas en esta categoría.</p>
          <button onClick={() => openBid(undefined, cat)} className="btn-gold">
            Sé el #1 — Pujar Ahora
          </button>
        </div>
      )}

      {data.length > 0 && (
        <p className="text-center text-[11px] text-white/40">
          Para liderar hay que superar la puja del #1 por al menos RD$ 100.
        </p>
      )}

      <div className="space-y-2.5">
        {data.map((e) => (
          <LeaderCard key={e.profile.id} entry={e} onBid={(pid) => openBid(pid, cat)} />
        ))}
      </div>
    </div>
  );
}
