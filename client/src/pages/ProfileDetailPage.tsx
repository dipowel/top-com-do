import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import Spinner from '../components/common/Spinner';
import { formatDOP } from '../lib/format';
import { whatsappLink, avatarFallback } from '../lib/share';
import { googleDirectionsUrl, wazeUrl } from '../lib/geo';
import { useShell } from '../hooks/useShell';
import { useAuctionAccess } from '../hooks/useAuctionAccess';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { useSeo } from '../hooks/useSeo';
import ProfileReviews from '../components/reviews/ProfileReviews';
import { categoryLabel, profileSeo } from '@shared/seo';
import Breadcrumbs, { type Crumb } from '../components/common/Breadcrumbs';
import type { ReviewSummary } from '@shared/types';

interface Detail {
  id: string;
  ownerUserId: string | null;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  tagline: string | null;
  subcategory: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  province: string | null;
  provinceName: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  categorySlug: string;
  categoryName: string;
  reviewSummary: ReviewSummary | null;
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
  const { user, me } = useAuth();
  const canBid = useAuctionAccess();
  const [params, setParams] = useSearchParams();
  const autoOpened = useRef(false);

  useEffect(() => {
    api<Detail>(`/profiles/${id}`)
      .then(setProfile)
      .catch(() => setNotFound(true));
    api<VerifiedBid[]>(`/profiles/${id}/bids`)
      .then(setBids)
      .catch(() => setBids([]));
  }, [id]);

  // Enlace del correo "Recuperar #1" / de las notificaciones → abre el checkout.
  useEffect(() => {
    if (params.get('pujar') === '1' && id && !autoOpened.current) {
      autoOpened.current = true;
      openBid(id);
      const next = new URLSearchParams(params);
      next.delete('pujar');
      setParams(next, { replace: true });
    }
  }, [params, id, openBid, setParams]);

  useSeo(profile ? profileSeo(profile, profile.reviewSummary) : null);

  if (notFound) return <p className="text-sm text-white/50">Perfil no encontrado.</p>;
  if (!profile) return <Spinner />;

  const total = bids.reduce((s, b) => s + Number(b.amountDop), 0);
  const isOwner = Boolean(me && profile.ownerUserId === me.id);

  const crumbs: Crumb[] = [
    { name: 'Inicio', to: '/' },
    { name: categoryLabel(profile.categorySlug) || profile.categoryName, to: `/rd/${profile.categorySlug}` },
    ...(profile.provinceName && profile.province
      ? [{ name: profile.provinceName, to: `/rd/${profile.categorySlug}/${profile.province}` }]
      : []),
    { name: profile.name },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumbs items={crumbs} />
      <div className="glass p-4">
        <div className="flex items-center gap-3">
          <img
            src={profile.avatarUrl || avatarFallback(profile.name)}
            width={64}
            height={64}
            decoding="async"
            fetchPriority="high"
            className="h-16 w-16 rounded-xl object-cover"
            alt={profile.name}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold">{profile.name}</h1>
            {profile.tagline && <p className="text-sm text-white/70">{profile.tagline}</p>}
            <p className="truncate text-xs text-white/40">
              {profile.subcategory ? `${profile.subcategory} · ` : ''}
              {profile.categoryName}
              {profile.provinceName ? ` · 📍 ${profile.provinceName}` : ''}
              {profile.city ? ` · ${profile.city}` : ''}
            </p>
          </div>
        </div>

        {profile.address && (
          <p className="mt-2 text-xs text-white/50">📍 {profile.address}</p>
        )}
        {profile.bio && profile.bio !== profile.tagline && (
          <p className="mt-3 text-sm text-white/60">{profile.bio}</p>
        )}
        {isOwner && (
          <Link to="/perfil" className="mt-3 block text-center text-xs text-gold underline">
            ✎ Editar mi negocio (nombre, enlaces, ubicación)
          </Link>
        )}
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {profile.whatsapp && (
              <a
                href={whatsappLink(profile.whatsapp, `Hola ${profile.name}, te vi en https://www.top.com.do`)}
                target="_blank"
                rel="noreferrer"
                className="btn-emerald min-w-[88px] flex-1 !py-2 text-xs"
              >
                WhatsApp
              </a>
            )}
            {profile.instagramUrl && (
              <a
                href={profile.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost min-w-[88px] flex-1 !py-2 text-xs"
              >
                Instagram
              </a>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost min-w-[64px] flex-1 !py-2 text-xs"
              >
                Web
              </a>
            )}
            {user && (
              <button
                onClick={() => toggle(profile.id)}
                className="btn-ghost min-w-[44px] flex-1 !py-2 text-xs"
              >
                {ids.has(profile.id) ? '★' : '☆'}
              </button>
            )}
          </div>
          {profile.latitude != null && profile.longitude != null && (
            <div className="flex gap-1.5">
              <a
                href={googleDirectionsUrl(profile.latitude, profile.longitude)}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost flex-1 !py-2 text-xs"
              >
                📍 Google Maps
              </a>
              <a
                href={wazeUrl(profile.latitude, profile.longitude)}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost flex-1 !py-2 text-xs"
              >
                Waze
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Apoyo comunitario — solo para comerciantes/participantes */}
      {canBid && (
        <section className="glass space-y-2 border border-gold/30 p-4 shadow-glow">
          <p className="text-sm font-bold text-gold">⚡ ¿Te encantó este lugar? Ayúdalos a liderar</p>
          <p className="text-xs text-white/60">
            No dejes que bajen del trono. Puja con un pequeño aporte para llevarlos o mantenerlos en
            el <span className="font-semibold text-gold">#1</span> indiscutible de la provincia.
          </p>
          <button onClick={() => openBid(profile.id)} className="btn-gold w-full">
            ⚡ Pujar y Apoyar este Negocio
          </button>
        </section>
      )}

      <div className="glass space-y-1.5 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-white/50">Visibilidad acumulada (últimos 7 días)</span>
          <b className="text-gold">{formatDOP(total)}</b>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/50">❤️ Apoyo de la comunidad</span>
          <b className="text-white/80">
            {bids.length} respaldo{bids.length === 1 ? '' : 's'} activo
            {bids.length === 1 ? '' : 's'}
          </b>
        </div>
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

      {/* Reseñas — debajo de las pujas, sin tocar la sección de competencia de arriba */}
      <ProfileReviews profileId={profile.id} isOwner={isOwner} />
    </div>
  );
}
