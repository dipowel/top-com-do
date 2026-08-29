import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { StarRating } from '../components/reviews/StarRating';

interface Row {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
  ipHash: string | null;
  profileId: string;
  profileName: string;
  authorEmail: string | null;
  authorName: string | null;
}

const FILTERS: Array<{ v: string; label: string }> = [
  { v: 'flagged', label: 'En revisión' },
  { v: 'published', label: 'Publicadas' },
  { v: 'hidden', label: 'Ocultas' },
];

export default function ReviewsQueue() {
  const [status, setStatus] = useState('flagged');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Row[]>(`/admin/reviews?status=${status}`, { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function setReviewStatus(id: string, s: 'published' | 'hidden') {
    setBusy(id);
    try {
      await api(`/admin/reviews/${id}/status`, { method: 'POST', body: JSON.stringify({ status: s }), auth: true });
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setStatus(f.v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === f.v ? 'border-gold/50 text-gold' : 'border-white/10 text-white/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!rows.length && <p className="text-sm text-white/50">Nada aquí.</p>}

      {rows.map((r) => (
        <div key={r.id} className="glass p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/p/${r.profileId}`} className="text-sm font-semibold">
                {r.profileName}
              </Link>
              <div className="mt-0.5 flex items-center gap-2">
                <StarRating value={r.rating} />
                <span className="text-[11px] text-white/40">
                  {r.authorName || r.authorEmail} · {new Date(r.createdAt).toLocaleString('es-DO')}
                </span>
              </div>
              {r.comment && <p className="mt-1 text-sm text-white/70">{r.comment}</p>}
              <p className="mt-1 text-[10px] text-white/25">device: {r.ipHash?.slice(0, 10) ?? '—'}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {r.status !== 'published' && (
              <button
                disabled={busy === r.id}
                onClick={() => setReviewStatus(r.id, 'published')}
                className="btn-emerald flex-1 !py-1.5 text-xs"
              >
                Publicar
              </button>
            )}
            {r.status !== 'hidden' && (
              <button
                disabled={busy === r.id}
                onClick={() => setReviewStatus(r.id, 'hidden')}
                className="btn-ghost flex-1 !py-1.5 text-xs"
              >
                Ocultar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
