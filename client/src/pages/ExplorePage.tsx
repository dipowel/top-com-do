import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import CategoryTabs from '../components/ranking/CategoryTabs';
import { useShell } from '../hooks/useShell';
import { useSeo } from '../hooks/useSeo';
import { avatarFallback } from '../lib/share';
import { CATEGORY_SLUGS } from '@shared/categories';
import { exploreSeo } from '@shared/seo';

interface P {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  categoryName: string;
}

export default function ExplorePage() {
  const params = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const cat = params.categoria && CATEGORY_SLUGS.includes(params.categoria) ? params.categoria : 'todo-rd';
  const [profiles, setProfiles] = useState<P[]>([]);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const { openBid } = useShell();

  useEffect(() => {
    const query = cat && cat !== 'todo-rd' ? `?category=${cat}` : '';
    api<P[]>(`/profiles${query}`)
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, [cat]);

  // Mantén ?q= en la URL para la SearchAction de los resultados enriquecidos.
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useSeo(exploreSeo(cat === 'todo-rd' ? null : cat, q));

  const filtered = useMemo(
    () => profiles.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [profiles, q],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Explorar negocios en República Dominicana</h1>
      <input
        className="input"
        placeholder="Buscar marca o persona…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <CategoryTabs
        value={cat}
        onChange={(slug) => navigate(slug === 'todo-rd' ? '/explorar' : `/explorar/${slug}`)}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {filtered.map((p) => (
          <div key={p.id} className="glass p-3">
            <Link to={`/p/${p.id}`}>
              <img
                src={p.avatarUrl || avatarFallback(p.name)}
                className="mb-2 h-16 w-16 rounded-xl object-cover"
                alt={p.name}
              />
              <div className="truncate text-sm font-bold">{p.name}</div>
              <div className="truncate text-[11px] text-white/40">{p.categoryName}</div>
            </Link>
            <button onClick={() => openBid(p.id)} className="btn-gold mt-2 w-full !py-1.5 text-xs">
              Pujar
            </button>
          </div>
        ))}
      </div>
      {!filtered.length && <p className="text-center text-xs text-white/40">Sin resultados.</p>}
    </div>
  );
}
