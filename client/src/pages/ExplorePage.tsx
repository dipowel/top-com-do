import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import CategoryTabs from '../components/ranking/CategoryTabs';
import { useShell } from '../hooks/useShell';
import { useAuctionAccess } from '../hooks/useAuctionAccess';
import { useSeo } from '../hooks/useSeo';
import { avatarFallback } from '../lib/share';
import {
  CATEGORY_SLUGS,
  subcategoriesWithSlugsFor,
  subcategoryLabel,
} from '@shared/categories';
import { exploreSeo, subcategorySeo } from '@shared/seo';

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

  const cat =
    params.categoria && CATEGORY_SLUGS.includes(params.categoria) ? params.categoria : 'todo-rd';
  const subChips = cat !== 'todo-rd' ? subcategoriesWithSlugsFor(cat) : [];
  const subLabel = params.sub ? subcategoryLabel(cat, params.sub) : '';
  const activeSub = subLabel ? params.sub! : undefined;

  const [profiles, setProfiles] = useState<P[]>([]);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const { openBid } = useShell();
  const canBid = useAuctionAccess();

  useEffect(() => {
    const qs = new URLSearchParams();
    if (cat && cat !== 'todo-rd') qs.set('category', cat);
    if (subLabel) qs.set('subcategory', subLabel);
    api<P[]>(`/profiles${qs.toString() ? `?${qs}` : ''}`)
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, [cat, subLabel]);

  // Mantén ?q= en la URL para la SearchAction de los resultados enriquecidos.
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useSeo(
    activeSub
      ? subcategorySeo({
          categorySlug: cat,
          subSlug: activeSub,
          items: profiles.slice(0, 20).map((p) => ({ id: p.id, name: p.name })),
        })
      : exploreSeo(cat === 'todo-rd' ? null : cat, q),
  );

  const filtered = useMemo(
    () => profiles.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [profiles, q],
  );

  const h1 = activeSub
    ? `Mejor ${subLabel} en República Dominicana`
    : 'Explorar negocios en República Dominicana';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">{h1}</h1>
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

      {subChips.length > 0 && (
        <nav aria-label="Filtrar por rubro" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Link
            to={`/explorar/${cat}`}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
              !activeSub ? 'border-gold/60 bg-gold/15 text-gold' : 'border-white/10 text-white/55'
            }`}
          >
            Todos
          </Link>
          {subChips.map((s) => (
            <Link
              key={s.slug}
              to={`/explorar/${cat}/${s.slug}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                activeSub === s.slug
                  ? 'border-gold/60 bg-gold/15 text-gold'
                  : 'border-white/10 text-white/55'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      )}

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
            {canBid && (
              <button onClick={() => openBid(p.id)} className="btn-gold mt-2 w-full !py-1.5 text-xs">
                Pujar
              </button>
            )}
          </div>
        ))}
      </div>
      {!filtered.length && <p className="text-center text-xs text-white/40">Sin resultados.</p>}
    </div>
  );
}
