import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { StarRating, StarInput } from './StarRating';
import type { ProfileReviewsResponse, ReviewDTO } from '@shared/types';

const COMMENT_MAX = 600;

export default function ProfileReviews({
  profileId,
  isOwner,
}: {
  profileId: string;
  isOwner: boolean;
}) {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState<ProfileReviewsResponse | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<ProfileReviewsResponse>(`/profiles/${profileId}/reviews`, {
        auth: Boolean(user),
      });
      setData(d);
      if (d.mine) {
        setRating(d.mine.rating);
        setComment(d.mine.comment ?? '');
      }
    } catch {
      /* ignore */
    }
  }, [profileId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (rating < 1) {
      setError('Elige de 1 a 5 estrellas.');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await api(`/profiles/${profileId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
        auth: true,
      });
      setOk(true);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary;
  const dist = summary?.distribution;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white/70">Reseñas y confianza</h2>

      {/* Resumen */}
      <div className="glass p-4">
        {summary && summary.count > 0 ? (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-gold">{summary.average.toFixed(1)}</div>
              <StarRating value={summary.average} />
              <div className="mt-0.5 text-[11px] text-white/40">
                {summary.count} reseña{summary.count === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = dist?.[String(n) as '1'] ?? 0;
                const pct = summary.count ? (c / summary.count) * 100 : 0;
                return (
                  <div key={n} className="flex items-center gap-2 text-[11px] text-white/40">
                    <span className="w-3">{n}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-4 text-right">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/50">Aún no hay reseñas de este negocio.</p>
        )}
      </div>

      {/* Tu reseña */}
      {!user ? (
        <div className="glass p-3 text-center text-xs text-white/50">
          <Link to="/login" className="text-gold underline">
            Inicia sesión
          </Link>{' '}
          para calificar este negocio.
        </div>
      ) : isOwner ? (
        <p className="text-[11px] text-white/35">
          Eres el dueño de este negocio: puedes responder reseñas, no calificarte.
        </p>
      ) : (
        <div className="glass space-y-2 p-3">
          <div className="text-xs font-semibold text-white/60">
            {data?.mine ? 'Tu reseña' : 'Deja tu reseña'}
          </div>
          <StarInput value={rating} onChange={setRating} />
          <textarea
            className="input"
            rows={3}
            maxLength={COMMENT_MAX}
            placeholder="Cuéntale a otros cómo fue tu experiencia (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          {ok && <p className="text-xs text-emerald-soft">✓ ¡Gracias por tu reseña!</p>}
          <button onClick={submit} disabled={busy} className="btn-gold w-full !py-2 text-xs">
            {busy ? 'Enviando…' : data?.mine ? 'Actualizar reseña' : 'Publicar reseña'}
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {data?.items.map((rv) => (
          <ReviewItem key={rv.id} rv={rv} isOwner={isOwner} isAdmin={isAdmin} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function ReviewItem({
  rv,
  isOwner,
  isAdmin,
  onChanged,
}: {
  rv: ReviewDTO;
  isOwner: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(rv.ownerReply ?? '');
  const [busy, setBusy] = useState(false);

  async function sendReply() {
    setBusy(true);
    try {
      await api(`/reviews/${rv.id}/reply`, { method: 'POST', body: JSON.stringify({ reply }), auth: true });
      setReplying(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm('¿Eliminar esta reseña?')) return;
    await api(`/reviews/${rv.id}`, { method: 'DELETE', auth: true });
    onChanged();
  }

  return (
    <div className={`glass p-3 ${rv.status === 'flagged' ? 'border border-amber-400/40' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <StarRating value={rv.rating} />
          <span className="ml-2 text-xs text-white/50">{rv.authorName}</span>
        </div>
        <span className="text-[10px] text-white/30">
          {new Date(rv.createdAt).toLocaleDateString('es-DO')}
        </span>
      </div>
      {rv.status === 'flagged' && (
        <p className="mt-1 text-[10px] text-amber-300">En revisión por posible sabotaje.</p>
      )}
      {rv.comment && <p className="mt-1.5 text-sm text-white/75">{rv.comment}</p>}

      {rv.ownerReply && (
        <div className="mt-2 rounded-lg border-l-2 border-gold/40 bg-white/5 p-2">
          <div className="text-[10px] font-bold text-gold/80">Respuesta del propietario</div>
          <p className="mt-0.5 text-xs text-white/70">{rv.ownerReply}</p>
        </div>
      )}

      {(isOwner || isAdmin) && !replying && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => setReplying(true)} className="btn-ghost !py-1 text-[11px]">
            {rv.ownerReply ? 'Editar respuesta' : 'Responder'}
          </button>
          {(rv.isMine || isAdmin) && (
            <button onClick={remove} className="btn-ghost !py-1 text-[11px]">
              Eliminar
            </button>
          )}
        </div>
      )}
      {rv.isMine && !isOwner && !isAdmin && (
        <button onClick={remove} className="btn-ghost mt-2 !py-1 text-[11px]">
          Eliminar mi reseña
        </button>
      )}

      {replying && (
        <div className="mt-2 space-y-1.5">
          <textarea
            className="input"
            rows={2}
            maxLength={COMMENT_MAX}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Responde con respeto…"
          />
          <div className="flex gap-2">
            <button onClick={sendReply} disabled={busy || !reply.trim()} className="btn-gold flex-1 !py-1.5 text-[11px]">
              {busy ? 'Enviando…' : 'Publicar respuesta'}
            </button>
            <button onClick={() => setReplying(false)} className="btn-ghost !py-1.5 text-[11px]">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
