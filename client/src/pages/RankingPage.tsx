import { useState } from 'react';
import CategoryTabs from '../components/ranking/CategoryTabs';
import LeaderCard from '../components/ranking/LeaderCard';
import Spinner from '../components/common/Spinner';
import { useRankings } from '../hooks/useRankings';
import { useShell } from '../hooks/useShell';
import { formatDOP } from '../lib/format';

const MIN_BID = 100;

export default function RankingPage() {
  const [cat, setCat] = useState('todo-rd');
  const { data, loading, error } = useRankings(cat);
  const { openBid } = useShell();

  const leader = data[0];
  const toLead = leader ? Number(leader.totalDop) + MIN_BID : MIN_BID;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">El directorio #1 de RD</h1>
        <p className="text-xs text-white/45">
          El negocio en el puesto #1 de cada categoría es el líder verificado y más cercano ·
          datos en vivo
        </p>
      </div>

      <CategoryTabs value={cat} onChange={setCat} />

      {/* Precio para tomar el puesto #1 — se calcula solo */}
      {!loading && !error && (
        <div className="glass overflow-hidden border border-gold/30 shadow-glow">
          <div className="flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gold/80">
                Para tomar el puesto #1
              </div>
              <div className="text-2xl font-black leading-tight text-gold">{formatDOP(toLead)}</div>
              <div className="mt-0.5 truncate text-[11px] text-white/45">
                {leader
                  ? `El #1 hoy es ${leader.profile.name} con ${formatDOP(Number(leader.totalDop))} · debes pujar por encima`
                  : `Nadie ha pujado aún · el primero en poner ${formatDOP(MIN_BID)} se lleva el #1`}
              </div>
            </div>
            <button
              onClick={() => openBid(leader?.profile.id, cat)}
              className="btn-gold shrink-0 !px-4 !py-2.5 text-xs"
            >
              Pujar para liderar
            </button>
          </div>
        </div>
      )}

      {loading && !data.length && <Spinner />}
      {error && (
        <div className="glass p-3 text-xs text-red-300">No se pudo cargar el ranking: {error}</div>
      )}
      {!loading && !data.length && !error && (
        <div className="glass p-6 text-center text-sm text-white/50">
          Aún no hay pujas activas en esta categoría. ¡La posición #1 está libre!
        </div>
      )}

      <div className="space-y-2.5">
        {data.map((e) => (
          <LeaderCard key={e.profile.id} entry={e} onBid={(pid) => openBid(pid, cat)} />
        ))}
      </div>
    </div>
  );
}
