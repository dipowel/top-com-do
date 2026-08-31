import { useNavigate, useParams } from 'react-router-dom';
import CategoryTabs from '../components/ranking/CategoryTabs';
import LeaderCard from '../components/ranking/LeaderCard';
import Spinner from '../components/common/Spinner';
import { useRankings } from '../hooks/useRankings';
import { useShell } from '../hooks/useShell';
import { useSeo } from '../hooks/useSeo';
import { formatDOP } from '../lib/format';
import { PROVINCE_DEFS, PROVINCE_SLUGS, provinceName } from '@shared/provinces';
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

  function go(nextCat: string, nextProv: string) {
    if (nextCat === 'todo-rd' && nextProv === 'todo-rd') navigate('/');
    else if (nextProv === 'todo-rd') navigate(`/rd/${nextCat}`);
    else navigate(`/rd/${nextCat}/${nextProv}`);
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
        <header aria-labelledby="hero-title" className="space-y-2 pt-1">
          <h1
            id="hero-title"
            className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
          >
            El directorio <span className="text-gold">#1</span> de la{' '}
            <span className="uppercase tracking-wide text-gold">República Dominicana</span>
          </h1>
          <h2 className="text-sm font-normal leading-relaxed text-white/70">
            Encuentra el mejor restaurante o negocio verificado de tu zona — o{' '}
            <button
              type="button"
              onClick={() => openBid()}
              aria-label="Pujar para posicionar tu negocio en el #1"
              className="font-semibold text-gold underline decoration-gold/50 underline-offset-2 hover:decoration-gold"
            >
              puja
            </button>{' '}
            para poner tu negocio en el <span className="text-gold">#1</span> y llevarte todas las
            llamadas y los clientes.
          </h2>
          <p className="text-xs text-white/50">
            ¿Buscas lo mejor? Aquí solo rankea el{' '}
            <strong className="font-semibold text-white/80">líder verificado</strong> de cada
            provincia.
          </p>
          <p className="text-[11px] text-white/35">
            <span className="text-emerald-soft">●</span> Datos en vivo · 32 provincias · negocios
            verificados
          </p>
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

      <nav aria-label="Filtrar por categoría">
        <CategoryTabs value={cat} onChange={(slug) => go(slug, province)} />
      </nav>

      {/* Filtro de provincia (las 32 demarcaciones) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/40">📍 Zona:</span>
        <select
          value={province}
          onChange={(e) => go(cat, e.target.value)}
          aria-label="Filtrar por provincia"
          className="input !w-auto flex-1 !py-1.5 text-xs"
        >
          {PROVINCE_DEFS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Precio para tomar el puesto #1 — se calcula solo según categoría + zona */}
      {!loading && !error && (
        <div className="glass border border-gold/30 shadow-glow">
          <div className="flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gold/80">
                Para tomar el #1 en {zona}
              </div>
              <div className="text-2xl font-black leading-tight text-gold">{formatDOP(toLead)}</div>
              <div className="mt-0.5 truncate text-[11px] text-white/45">
                {leader
                  ? `El #1 hoy es ${leader.profile.name} con ${formatDOP(Number(leader.totalDop))} · debes pujar por encima`
                  : `Zona libre · el primero en poner ${formatDOP(MIN_BID)} se lleva el #1`}
              </div>
            </div>
            <button
              onClick={() => openBid(leader?.profile.id, cat, province)}
              className="btn-gold shrink-0 !px-4 !py-2.5 text-xs"
            >
              Pujar para liderar
            </button>
          </div>
        </div>
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

      <div className="space-y-2.5">
        {data.map((e) => (
          <LeaderCard
            key={e.profile.id}
            entry={e}
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
