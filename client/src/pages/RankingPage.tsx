import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CategoryTabs from '../components/ranking/CategoryTabs';
import ChampionMedal from '../components/ranking/ChampionMedal';
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
import { categoryLabel, categorySeo, homeSeo } from '@shared/seo';

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
  const catName = cat === 'todo-rd' ? 'negocios' : categoryLabel(cat) || 'negocios';

  useSeo(
    cat === 'todo-rd' && isNational
      ? homeSeo()
      : categorySeo({
          categorySlug: cat,
          provinceSlug: province,
          items: data.slice(0, 20).map((e) => ({ id: e.profile.id, name: e.profile.name })),
        }),
  );

  const isHome = cat === 'todo-rd' && isNational;
  const h1 = `Los mejores ${catName} en ${isNational ? 'República Dominicana' : zona}`;

  return (
    <div className="space-y-4">
      {isHome ? (
        <header aria-labelledby="hero-title" className="space-y-4 pt-1">
          <div className="space-y-2.5">
            <h1
              id="hero-title"
              className="text-[26px] font-extrabold leading-[1.15] tracking-tight sm:text-3xl"
            >
              <span className="text-gold">Publicidad efectiva:</span> domina el puesto{' '}
              <span className="text-gold">#1</span> de tu categoría y consigue{' '}
              <span className="text-gold">más clientes potenciales</span>.
            </h1>
            <p className="text-sm leading-relaxed text-white/65">
              Solo hay un líder por provincia y categoría. Supera a tu competencia con tu puja y
              recibe llamadas directas a tu{' '}
              <span className="font-semibold text-emerald-soft">WhatsApp</span>.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <section className="glass space-y-2 p-3.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-sm"
                >
                  📢
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gold/85">
                  Para dueños de negocios
                </h2>
              </div>
              <p className="text-[12.5px] leading-snug text-white/65">
                Mira cuánto está pagando el #1. Haz una oferta mayor y sube al primer lugar.
              </p>
              <Link
                to="/publicar"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
              >
                Anuncia tu negocio <span aria-hidden>→</span>
              </Link>
            </section>

            <section className="glass space-y-2 p-3.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-soft/40 bg-emerald-soft/10 text-sm"
                >
                  ⭐
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-soft/85">
                  Para clientes
                </h2>
              </div>
              <p className="text-[12.5px] leading-snug text-white/65">
                Encuentra los mejores negocios verificados en tu provincia y contáctalos al instante
                por WhatsApp o llamada.
              </p>
            </section>
          </div>

          <section
            aria-label="Cómo funciona: el #1 ahora mismo"
            className="glass space-y-3 border border-gold/20 p-3.5"
          >
            <h2 className="text-center text-[11px] font-bold uppercase tracking-widest text-white/50">
              ¿Cómo funciona? El #1 ahora mismo
            </h2>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1.5 text-center sm:gap-2">
              <div className="space-y-1">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-gold/80">
                  #1 actual
                </div>
                <div className="text-[15px] font-black tabular-nums text-gold sm:text-base">
                  {loading && !data.length
                    ? '…'
                    : leader
                      ? formatDOP(Number(leader.totalDop))
                      : 'Libre'}
                </div>
                <div className="text-[10px] leading-tight text-white/45 break-words">
                  {leader ? `👑 ${leader.profile.name}` : 'Nadie manda esta zona'}
                </div>
              </div>
              <span aria-hidden className="self-center text-white/25">
                →
              </span>
              <div className="space-y-1">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-soft/80">
                  Tú pujas
                </div>
                <div className="text-[15px] font-black tabular-nums text-emerald-soft sm:text-base">
                  {loading && !data.length ? '…' : formatDOP(toLead)}
                </div>
                <div className="text-[10px] leading-tight text-white/45">
                  {leader ? 'Superas su oferta' : 'Tomas el #1 libre'}
                </div>
              </div>
              <span aria-hidden className="self-center text-white/25">
                →
              </span>
              <div className="space-y-1">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-gold/80">
                  Tú subes al #1
                </div>
                <div className="flex justify-center">
                  <ChampionMedal className="!h-10 !w-10 sm:!h-12 sm:!w-12" />
                </div>
                <div className="text-[10px] leading-tight text-white/45">Eres el nuevo líder</div>
              </div>
            </div>
          </section>
        </header>
      ) : (
        <div>
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
    </div>
  );
}
