import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Spinner from '../components/common/Spinner';
import { formatDOP } from '../lib/format';
import { whatsappLink, avatarFallback } from '../lib/share';
import { useShell } from '../hooks/useShell';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';

interface Detail {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  tagline: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  city: string | null;
  categoryName: string;
}

interface VerifiedBid {
  id: string;
  amountDop: number;
  bidderName: string | null;
}

export default function ProfileDetailPage() {
  const { id = '' } = useParams();
  const [profile, setProfile] = useState<Detail | null>(null);
  const [bids, setBids] = useState<VerifiedBid[]>([]);
  const [notFound, setNotFound] = useState(false);
  const { openBid } = useShell();
  const { ids, toggle } = useFavorites();
  const { user } = useAuth();

  useEffect(() => {
    api<Detail>(`/profiles/${id}`)
      .then(setProfile)
      .catch(() => setNotFound(true));
    api<VerifiedBid[]>(`/profiles/${id}/bids`)
      .then(setBids)
      .catch(() => setBids([]));
  }, [id]);

  if (notFound) return <p className="text-sm text-white/50">Perfil no encontrado.</p>;
  if (!profile) return <Spinner />;

  const total = bids.reduce((s, b) => s + Number(b.amountDop), 0);

  return (
    <div className="space-y-4">
      <div className="glass p-4">
        <div className="flex items-center gap-3">
          <img
            src={profile.avatarUrl || avatarFallback(profile.name)}
            className="h-16 w-16 rounded-xl object-cover"
            alt=""
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold">{profile.name}</h1>
            {profile.tagline && <p className="text-sm text-white/70">{profile.tagline}</p>}
            <p className="truncate text-xs text-white/40">
              @{profile.handle} · {profile.categoryName}
              {profile.city ? ` · ${profile.city}` : ''}
            </p>
          </div>
        </div>
        {profile.bio && profile.bio !== profile.tagline && (
          <p className="mt-3 text-sm text-white/60">{profile.bio}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => openBid(profile.id)} className="btn-gold flex-1">
            Pujar por este perfil
          </button>
          {profile.whatsapp && (
            <a
              href={whatsappLink(profile.whatsapp, `Hola ${profile.name}, te vi en Top.com.do`)}
              target="_blank"
              rel="noreferrer"
              className="btn-emerald"
            >
              WhatsApp
            </a>
          )}
          {profile.instagramUrl && (
            <a href={profile.instagramUrl} target="_blank" rel="noreferrer" className="btn-ghost">
              Instagram
            </a>
          )}
          {profile.websiteUrl && (
            <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="btn-ghost">
              Web
            </a>
          )}
          {user && (
            <button onClick={() => toggle(profile.id)} className="btn-ghost">
              {ids.has(profile.id) ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>

      <div className="glass flex justify-between p-4 text-sm">
        <span className="text-white/50">Visibilidad acumulada (ronda)</span>
        <b className="text-gold">{formatDOP(total)}</b>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-white/70">Pujas verificadas</h2>
        <div className="space-y-2">
          {bids.map((b) => (
            <div key={b.id} className="glass flex justify-between p-3 text-sm">
              <span>{b.bidderName || 'Anónimo'}</span>
              <span className="font-bold text-gold">{formatDOP(Number(b.amountDop))}</span>
            </div>
          ))}
          {!bids.length && <p className="text-xs text-white/40">Sin pujas verificadas todavía.</p>}
        </div>
      </div>
    </div>
  );
}
