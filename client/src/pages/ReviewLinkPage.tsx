import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';

/**
 * Enlace corto "Pedir reseñas por WhatsApp" (`top.com.do/r/:handle`). Resuelve el handle al
 * negocio real, marca la visita como `review_link` (contacto válido al instante si hay sesión
 * — ver `markReviewVerifiedIfEligible`) y manda derecho a la ficha a dejar la reseña.
 */
export default function ReviewLinkPage() {
  const { handle = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    api<{ id: string }>(`/profiles/by-handle/${handle}`)
      .then(async (r) => {
        if (!alive) return;
        if (user) {
          await api(`/profiles/${r.id}/events`, {
            method: 'POST',
            body: JSON.stringify({ eventType: 'review_link', sessionId: 'review-link' }),
            auth: true,
          }).catch(() => {});
        }
        if (alive) setProfileId(r.id);
      })
      .catch(() => alive && setNotFound(true));
    return () => {
      alive = false;
    };
  }, [handle, user, authLoading]);

  if (notFound) return <p className="text-sm text-white/50">Negocio no encontrado.</p>;
  if (!profileId) return <Spinner />;
  return <Navigate to={`/p/${profileId}?pedir_resena=1`} replace />;
}
