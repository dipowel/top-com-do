import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import CategoryTabs from '../components/ranking/CategoryTabs';
import { useShell } from '../hooks/useShell';
import { useAuth } from '../hooks/useAuth';
import { useAuctionAccess } from '../hooks/useAuctionAccess';
import { useSeo } from '../hooks/useSeo';
import { avatarFallback } from '../lib/share';
import {
  CATEGORY_SLUGS,
  subcategoriesWithSlugsFor,
  subcategoryLabel,
} from '@shared/categories';
import { PROVINCE_DEFS, PROVINCE_SLUGS, NATIONAL_SLUG, provinceName } from '@shared/provinces';
import { exploreSeo, subcategorySeo, subcategoryProvinceSeo } from '@shared/seo';

const FEATURED_PROVINCE_SLUGS = ['distrito-nacional', 'santo-domingo', 'santiago', 'la-altagracia', 'la-vega'];
const FEATURED_PROVINCES = FEATURED_PROVINCE_SLUGS.map((s) => PROVINCE_DEFS.find((p) => p.slug === s)!).filter(Boolean);

interface P {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  categoryName: string;
}

export default function ExplorePage() {
  const params = useParams();
  const [sp, setSp] = useSearchParams();

  const cat =
    params.categoria && CATEGORY_SLUGS.includes(params.categoria) ? params.categoria : 'todo-rd';
  const subChips = cat !== 'todo-rd' ? subcategoriesWithSlugsFor(cat) : [];
  const subLabel = params.sub ? subcategoryLabel(cat, params.sub) : '';
  const activeSub = subLabel ? params.sub! : undefined;
  const prov =
    params.provincia && PROVINCE_SLUGS.includes(params.provincia) && params.provincia !== NATIONAL_SLUG
      ? params.provincia
      : undefined;

  const [profiles, setProfiles] = useState<P[]>([]);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const { openBid } = useShell();
  const { user } = useAuth();
  const canBid = useAuctionAccess();

  useEffect(() => {
    const qs = new URLSearchParams();
    if (cat && cat !== 'todo-rd') qs.set('category', cat);
    if (subLabel) qs.set('subcategory', subLabel);
    if (prov) qs.set('province', prov);
    api<P[]>(`/profiles${qs.toString() ? `?${qs}` : ''}`)
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, [cat, subLabel, prov]);

  // Mantén ?q= en la URL para la SearchAction de los resultados enriquecidos.
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useSeo(
    activeSub && prov
      ? subcategoryProvinceSeo({
          categorySlug: cat,
          subSlug: activeSub,
          provinceSlug: prov,
          items: profiles.slice(0, 20).map((p) => ({ id: p.id, name: p.name })),
        })
      : activeSub
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

  const h1 =
    activeSub && prov
      ? `Mejor ${subLabel} en ${provinceName(prov)}`
      : activeSub
        ? `Mejor ${subLabel} en República Dominicana`
        : 'Explorar negocios en República Dominicana';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">{h1}</h1>

      {!canBid && (
        <section className="glass flex flex-col gap-2 border border-gold/25 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-white">
              ¿Tienes un negocio? Aparece <span className="text-emerald-soft">gratis</span>
            </h2>
            <p className="mt-0.5 text-xs text-white/55">
              Regístralo en el directorio y deja que tus clientes te encuentren. Sin costo, en
              minutos.
            </p>
          </div>
          <Link
            to={user ? '/perfil' : '/login?registro=1'}
            className="btn-gold shrink-0 whitespace-nowrap !py-2.5 text-xs"
          >
            Registrar mi negocio gratis
          </Link>
        </section>
      )}

      <input
        className="input"
        placeholder="Buscar marca o persona…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <CategoryTabs
        value={cat}
        hrefFor={(slug) => (slug === 'todo-rd' ? '/explorar' : `/explorar/${slug}`)}
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

      {activeSub && (
        <nav
          aria-label="Filtrar por provincia"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
        >
          <Link
            to={`/explorar/${cat}/${activeSub}`}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
              !prov ? 'border-gold/60 bg-gold/15 text-gold' : 'border-white/10 text-white/55'
            }`}
          >
            🇩🇴 Todo RD
          </Link>
          {FEATURED_PROVINCES.map((p) => (
            <Link
              key={p.slug}
              to={`/explorar/${cat}/${activeSub}/${p.slug}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                prov === p.slug
                  ? 'border-gold/60 bg-gold/15 text-gold'
                  : 'border-white/10 text-white/55'
              }`}
            >
              📍 {p.name}
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
