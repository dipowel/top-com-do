import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RankingEntry } from '@shared/types';
import { formatDOP } from '../../lib/format';
import { whatsappLink, avatarFallback } from '../../lib/share';
import { PositionBadge, CrownBadge } from './PositionBadge';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../hooks/useAuth';
import ViralCard from '../share/ViralCard';

export default function LeaderCard({
  entry,
  onBid,
}: {
  entry: RankingEntry;
  onBid: (profileId: string) => void;
}) {
  const { user } = useAuth();
  const { ids, toggle } = useFavorites();
  const [share, setShare] = useState(false);
  const p = entry.profile;
  const fav = ids.has(p.id);

  return (
    <div className={`glass p-3 ${entry.isChampion ? 'shadow-glow ring-1 ring-gold/40' : ''}`}>
      <div className="flex items-center gap-3">
        <PositionBadge position={entry.position} champion={entry.isChampion} />
        <Link to={`/p/${p.id}`}>
          <img
            src={p.avatarUrl || avatarFallback(p.name)}
            alt={p.name}
            className="h-12 w-12 rounded-xl object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {entry.isChampion && <CrownBadge />}
            <Link to={`/p/${p.id}`} className="truncate font-bold">
              {p.name}
            </Link>
          </div>
          <div className="truncate text-xs text-white/45">
            @{p.handle} · {p.categoryName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold text-gold">{formatDOP(entry.totalDop)}</div>
          <div className="text-[10px] text-white/40">
            {entry.bidsCount} puja{entry.bidsCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onBid(p.id)} className="btn-gold flex-1 !py-2 text-xs">
          Pujar por {p.name.split(' ')[0]}
        </button>
        {p.whatsapp && (
          <a
            href={whatsappLink(p.whatsapp, `Hola ${p.name}, te vi en Top.com.do`)}
            target="_blank"
            rel="noreferrer"
            className="btn-emerald !py-2 text-xs"
          >
            WhatsApp
          </a>
        )}
        {user && (
          <button onClick={() => toggle(p.id)} className="btn-ghost !py-2 text-xs" aria-label="Favorito">
            {fav ? '★' : '☆'}
          </button>
        )}
        <button onClick={() => setShare(true)} className="btn-ghost !py-2 text-xs">
          Compartir
        </button>
      </div>

      {share && <ViralCard entry={entry} onClose={() => setShare(false)} />}
    </div>
  );
}
