import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CategoryTabs from '../components/ranking/CategoryTabs';
import ProvinceChips from '../components/ranking/ProvinceChips';
import LeaderCard from '../components/ranking/LeaderCard';
import Spinner from '../components/common/Spinner';
import { useRankings } from '../hooks/useRankings';
import { useShell } from '../hooks/useShell';
import { useAuctionAccess } from '../hooks/useAuctionAccess';
import { useSeo } from '../hooks/useSeo';
import { formatDOP } from '../lib/format';
import { PROVINCE_SLUGS, provinceName } from '@shared/provinces';
import { CATEGORY_SLUGS } from '@shared/categories';
import { categoryLabel, categoryNoun, categoryFaqs, categorySeo, homeSeo } from '@shared/seo';
import Breadcrumbs, { type Crumb } from '../components/common/Breadcrumbs';

const MIN_BID = 100;

export default function RankingPage() {
  const params = useParams();
  const navigate = useNavigate();

  const cat = params.categoria && CATEGORY_SLUGS.includes(params.categoria) ? params.categoria : 'todo-rd';
  const province =
    params.provincia && PROVINCE_SLUGS.includes(params.provincia) ? params.provincia : 'todo-rd';

  const { data, loading, error } = useRankings(cat, province);
  const { openBid } = useShell();
  const canBid = useAuctionAccess();
  const [search, setSearch] = useState('');

  function rankingHref(nextCat: string, nextProv: string): string {
    if (nextCat === 'todo-rd' && nextProv === 'todo-rd') return '/';
    if (nextProv === 'todo-rd') return `/rd/${nextCat}`;
    return `/rd/${nextCat}/${nextProv}`;
  }

  const leader = data[0];
  const toLead = leader ? Number(leader.totalDop) + MIN_BID : MIN_BID;
  const isNational = province === 'todo-rd';
  const zona = isNational ? 'Todo RD' : provinceName(province);
  const catName = cat === 'todo-rd' ? 'negocios' : categoryNoun(cat);

  useSeo(
    cat === 'todo-rd' && isNational
      ? homeSeo()
      : categorySeo({
          categorySlug: cat,
          provinceSlug: province,
          items: data.slice(0, 20).map((e) => ({
            id: e.profile.id,
            name: e.profile.name,
            image: e.profile.avatarUrl,
            city: e.profile.city,
            province: e.profile.province,
            categorySlug: e.profile.categorySlug,
          })),
        }),
  );

  const isHome = cat === 'todo-rd' && isNational;
  const h1 = `Los mejores ${catName} en ${isNational ? 'República Dominicana' : zona}`;

  const crumbs: Crumb[] = isHome
    ? []
    : [
        { name: 'Inicio', to: '/' },
        ...(cat !== 'todo-rd' ? [{ name: categoryLabel(cat), to: `/rd/${cat}` }] : []),
        ...(!isNational ? [{ name: zona }] : []),
      ];
  const faqs = !isHome && data.length ? categoryFaqs(cat === 'todo-rd' ? null : cat, isNational ? 'República Dominicana' : zona) : [];

  return (
    <div className="space-y-4">
      {isHome ? (
        <header aria-labelledby="hero-title" className="space-y-3 pt-1">
          <h1
            id="hero-title"
            className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl"
          >
            El ranking <span className="text-gold">#1</span> de negocios de la República Dominicana
          </h1>
          <p className="text-sm leading-relaxed text-white/60">
            Un solo líder por categoría y provincia. Compite por el primer lugar desde
            <span className="font-semibold text-gold"> RD$100</span> y llévate las llamadas.
          </p>
          <Link
            to="/explorar"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white/60"
          >
            🔎 ¿Solo quieres aparecer en el directorio? Explóralo gratis <span aria-hidden>→</span>
          </Link>
        </header>
      ) : (
        <div className="space-y-1.5">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-xl font-extrabold">{h1}</h1>
          <p className="text-xs text-white/45">
            El negocio en el puesto #1 de cada categoría y provincia es el líder verificado y más
            cercano · datos en vivo
          </p>
        </div>
      )}

      {/* Provincia (chips + "Más") */}
      <nav aria-label="Filtrar por provincia">
        <ProvinceChips value={province} hrefFor={(p) => rankingHref(cat, p)} />
      </nav>

      {/* Búsqueda rápida */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const term = search.trim();
          navigate(term ? `/explorar?q=${encodeURIComponent(term)}` : '/explorar');
        }}
        className="flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoría o negocio"
          aria-label="Buscar categoría o negocio"
          className="input flex-1"
        />
        <Link to="/explorar" className="btn-ghost shrink-0 !px-3 !py-2 text-[11px]">
          ⊞ Todas las categorías
        </Link>
      </form>

      {/* Categoría */}
      <nav aria-label="Filtrar por categoría">
        <CategoryTabs value={cat} hrefFor={(slug) => rankingHref(slug, province)} />
      </nav>

      {/* Precio para tomar el puesto #1 */}
      {isHome ? (
        <div className="glass flex items-center justify-between gap-3 border border-gold/30 p-3.5 shadow-glow">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="text-2xl">
              ⚡
            </span>
            <div className="min-w-0">
              <div className="text-[11px] text-white/50">Empieza desde</div>
              <div className="text-xl font-black leading-tight text-gold">{formatDOP(MIN_BID)}</div>
            </div>
          </div>
          <button
            onClick={() => openBid(undefined, cat, province)}
            className="btn-gold shrink-0 !px-5 !py-3 text-sm uppercase tracking-wide"
          >
            Crea tu puja ahora <span aria-hidden>→</span>
          </button>
        </div>
      ) : (
        !loading &&
        !error && (
          <div className="glass border border-gold/30 shadow-glow">
            <div className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gold/80">
                  Para tomar el #1 en {zona}
                </div>
                <div className="text-2xl font-black leading-tight text-gold">
                  {formatDOP(toLead)}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-white/45">
                  {leader
                    ? `El #1 hoy es ${leader.profile.name} con ${formatDOP(Number(leader.totalDop))} · debes pujar por encima`
                    : `Zona libre · el primero en poner ${formatDOP(MIN_BID)} se lleva el #1`}
                </div>
              </div>
              {canBid && (
                <button
                  onClick={() => openBid(undefined, cat, province)}
                  className="btn-gold shrink-0 !px-4 !py-2.5 text-xs uppercase tracking-wide"
                >
                  ¡Pujar ahora!
                </button>
              )}
            </div>
          </div>
        )
      )}

      {loading && !data.length && <Spinner />}
      {error && (
        <div className="glass p-3 text-xs text-red-300">No se pudo cargar el ranking: {error}</div>
      )}
      {!loading && !data.length && !error && (
        <div className="glass p-6 text-center text-sm text-white/50">
          Aún no hay pujas activas en {zona}. ¡La posición #1 está libre!
        </div>
      )}

      {!!data.length && (
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-bold text-white/85">Ranking en {zona}</h2>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-soft">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-soft" /> En vivo
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {data.map((e) => (
          <LeaderCard
            key={e.profile.id}
            entry={e}
            canBid={canBid}
            onBid={(pid) => openBid(pid, cat, province)}
            recoverAmount={
              e.position === 2 && data[0]
                ? Math.max(Number(data[0].totalDop) - Number(e.totalDop) + 100, 100)
                : undefined
            }
          />
        ))}
      </div>

      {faqs.length > 0 && (
        <section className="glass space-y-3 p-4">
          <h2 className="text-sm font-extrabold text-white">Preguntas frecuentes</h2>
          <dl className="space-y-3">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="text-xs font-bold text-white/80">{f.q}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-white/50">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
