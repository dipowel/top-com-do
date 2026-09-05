import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RankingEntry } from '@shared/types';
import { formatDOP } from '../../lib/format';
import { whatsappLink, avatarFallback } from '../../lib/share';
import { googleDirectionsUrl } from '../../lib/geo';
import { PositionBadge, CrownBadge } from './PositionBadge';
import ChampionMedal from './ChampionMedal';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../hooks/useAuth';

// html-to-image (~pesado) solo se carga al abrir la tarjeta para compartir.
const ViralCard = lazy(() => import('../share/ViralCard'));

export default function LeaderCard({
  entry,
  onBid,
  recoverAmount,
  canBid = false,
}: {
  entry: RankingEntry;
  onBid: (profileId: string) => void;
  /** Monto exacto para que este #2 recupere el #1 (solo se pasa a la posición 2). */
  recoverAmount?: number;
  /** Si el usuario es comerciante/participante: muestra el botón de puja. */
  canBid?: boolean;
}) {
  const { user } = useAuth();
  const { ids, toggle } = useFavorites();
  const [share, setShare] = useState(false);
  const p = entry.profile;
  const fav = ids.has(p.id);

  return (
    <div className={`glass p-3 ${entry.isChampion ? 'shadow-glow ring-1 ring-gold/40' : ''}`}>
      <div className="flex items-center gap-3">
        {entry.isChampion ? (
          <ChampionMedal />
        ) : (
          <PositionBadge position={entry.position} champion={entry.isChampion} />
        )}
        <Link to={`/p/${p.id}`}>
          <img
            src={p.avatarUrl || avatarFallback(p.name)}
            alt={p.name}
            width={48}
            height={48}
            loading={entry.isChampion ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={entry.isChampion ? 'high' : undefined}
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
          {p.tagline ? (
            <div className="truncate text-xs text-white/60">{p.tagline}</div>
          ) : null}
          <div className="truncate text-[11px] text-white/40">
            {p.subcategory ? `${p.subcategory} · ` : ''}
            {p.categoryName}
            {p.provinceName ? ` · 📍 ${p.provinceName}` : p.city ? ` · ${p.city}` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold text-gold">{formatDOP(entry.totalDop)}</div>
          <div className="text-[10px] text-white/40">
            {entry.bidsCount} puja{entry.bidsCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {canBid && (
          <button onClick={() => onBid(p.id)} className="btn-gold w-full !py-2.5 text-xs">
            {entry.position === 2
              ? `🔥 Recuperar el #1${recoverAmount ? ` · ${formatDOP(recoverAmount)}` : ''}`
              : `Pujar por ${p.name.split(' ')[0]}`}
          </button>
        )}

        {/* Acciones secundarias: se reparten y envuelven (2+ por fila en móvil, 1 fila en PC) */}
        <div className="flex flex-wrap gap-1.5">
          {p.whatsapp && (
            <a
              href={whatsappLink(p.whatsapp, `Hola ${p.name}, te vi en https://www.top.com.do`)}
              target="_blank"
              rel="noreferrer"
              className="btn-emerald min-w-[88px] flex-1 !px-2 !py-1.5 text-[11px]"
            >
              WhatsApp
            </a>
          )}
          {p.instagramUrl && (
            <a
              href={p.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost min-w-[88px] flex-1 !px-2 !py-1.5 text-[11px]"
            >
              Instagram
            </a>
          )}
          {p.websiteUrl && (
            <a
              href={p.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost min-w-[64px] flex-1 !px-2 !py-1.5 text-[11px]"
            >
              Web
            </a>
          )}
          {p.latitude != null && p.longitude != null && (
            <a
              href={googleDirectionsUrl(p.latitude, p.longitude)}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost min-w-[92px] flex-1 !px-2 !py-1.5 text-[11px]"
            >
              📍 Cómo llegar
            </a>
          )}
          {user && (
            <button
              onClick={() => toggle(p.id)}
              className="btn-ghost min-w-[44px] flex-1 !px-2 !py-1.5 text-[11px]"
              aria-label="Favorito"
            >
              {fav ? '★' : '☆'}
            </button>
          )}
          <button
            onClick={() => setShare(true)}
            className="btn-ghost min-w-[84px] flex-1 !px-2 !py-1.5 text-[11px]"
          >
            Compartir
          </button>
        </div>
      </div>

      {share && (
        <Suspense fallback={null}>
          <ViralCard entry={entry} onClose={() => setShare(false)} />
        </Suspense>
      )}
    </div>
  );
}
