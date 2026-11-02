import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useShell } from '../hooks/useShell';
import { useNewModel } from '../hooks/useNewModel';
import { useSeo } from '../hooks/useSeo';
import { formatDOP } from '../lib/format';
import { whatsappLink } from '../lib/share';
import Spinner from '../components/common/Spinner';
import ActivityChart from '../components/business/ActivityChart';
import { StarRating } from '../components/reviews/StarRating';
import type { BusinessStatsResponse, BusinessStatsRange } from '@shared/types';

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}
interface RankChecklistResponse {
  rankScore: number;
  profileCompleteness: number;
  reviewsCount: number;
  ratingAvg: number;
  fastResponseRate: number;
  checklist: ChecklistItem[];
  reviewLinkPath: string;
}

const RANGE_LABEL: Record<BusinessStatsRange, string> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  all: 'Todo el tiempo',
};

type ChartMetric = 'businessView' | 'whatsappClick' | 'locationClick';
const METRIC_LABEL: Record<ChartMetric, string> = {
  businessView: 'Visualizaciones',
  whatsappClick: 'WhatsApp',
  locationClick: 'Ubicación',
};

export default function BusinessDashboardPage() {
  const { id = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { openBid } = useShell();
  const newModel = useNewModel();
  const [range, setRange] = useState<BusinessStatsRange>('7d');
  const [metric, setMetric] = useState<ChartMetric>('businessView');
  const [stats, setStats] = useState<BusinessStatsResponse | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rankChecklist, setRankChecklist] = useState<RankChecklistResponse | null>(null);

  useSeo({
    title: 'Rendimiento de tu negocio | Top.com.do',
    description: 'Panel privado de métricas del negocio.',
    canonical: `https://www.top.com.do/perfil/negocio/${id}`,
    noindex: true,
  });

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    api<BusinessStatsResponse>(`/profiles/${id}/stats?range=${range}`, { auth: true })
      .then((r) => {
        if (alive) {
          setStats(r);
          setForbidden(false);
        }
      })
      .catch((e: Error) => {
        if (!alive) return;
        if (/403|Solo el dueño/i.test(e.message)) setForbidden(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, range, user]);

  useEffect(() => {
    if (!user || !newModel) return;
    api<RankChecklistResponse>(`/profiles/${id}/rank-checklist`, { auth: true })
      .then(setRankChecklist)
      .catch(() => {});
  }, [id, user, newModel]);

  if (!authLoading && !user) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/perfil/negocio/${id}`)}`} replace />;
  }

  if (forbidden) {
    return (
      <div className="glass space-y-2 p-6 text-center text-sm text-white/60">
        <p>Solo el dueño de este negocio puede ver sus estadísticas.</p>
        <Link to="/perfil" className="text-gold underline">
          Volver a mis negocios
        </Link>
      </div>
    );
  }

  const chartData = (stats?.daily ?? []).map((d) => ({ date: d.date, value: d[metric] }));
  const totalInteractions = stats
    ? stats.counts.whatsapp_click + stats.counts.location_click + stats.counts.instagram_click + stats.counts.website_click
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-white">El rendimiento de tu negocio en Top</h1>
          <p className="text-sm text-white/55">Descubre cuántas personas están viendo e interactuando con tu negocio.</p>
        </div>
        <Link to={`/perfil/negocio/${id}/planes`} className="btn-gold shrink-0 !px-3 !py-2 text-xs">
          Planes
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(RANGE_LABEL) as BusinessStatsRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              range === r ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 text-white/50'
            }`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      {loading || !stats ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard icon="👁️" label="Personas que vieron tu negocio" value={stats.counts.business_view} />
            <StatCard icon="📱" label="Clics en WhatsApp" value={stats.counts.whatsapp_click} />
            <StatCard icon="📍" label="Solicitudes de ubicación" value={stats.counts.location_click} />
            <StatCard
              icon="🔗"
              label="Redes y sitio web"
              value={stats.counts.instagram_click + stats.counts.website_click}
            />
          </div>

          <section className="glass space-y-2 p-4">
            <h2 className="text-sm font-bold text-white">¿Qué obtuviste con Top?</h2>
            <p className="text-sm text-white/70">
              En {RANGE_LABEL[range].toLowerCase()}, <b className="text-white">{stats.counts.business_view}</b>{' '}
              persona{stats.counts.business_view === 1 ? '' : 's'} vieron tu negocio
              {totalInteractions > 0 && (
                <>
                  {' '}
                  y <b className="text-white">{totalInteractions}</b> interactuaron contigo (WhatsApp, ubicación o
                  redes).
                </>
              )}
              .
            </p>
            <p className="text-xs text-white/45">
              Top te ayuda a convertir visibilidad en oportunidades de contacto.
            </p>
          </section>

          {stats.investment && (
            <section className="glass space-y-1.5 p-4 text-sm">
              <h2 className="text-sm font-bold text-white">Inversión en Top</h2>
              <Row label="Inversión" value={formatDOP(stats.investment.investedDop)} />
              <Row label="Interacciones generadas" value={String(stats.investment.interactions)} />
              <Row label="Costo por interacción" value={formatDOP(stats.investment.costPerInteractionDop)} />
            </section>
          )}

          <section className="glass space-y-2 border border-gold/25 p-4">
            <h2 className="text-sm font-bold text-white">Tu posición</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-gold">
                  {stats.ranking.position ? `#${stats.ranking.position}` : 'Sin ranking aún'}
                </div>
                <div className="text-xs text-white/45">
                  {stats.ranking.categoryName} · {stats.ranking.provinceName}
                </div>
              </div>
              {stats.ranking.isLeader ? (
                <span className="rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold">👑 #1</span>
              ) : stats.ranking.leaderName ? (
                <span className="text-right text-[11px] text-white/45">
                  El #1 es {stats.ranking.leaderName}
                </span>
              ) : null}
            </div>
            {stats.ranking.daysAsLeader > 0 && (
              <p className="text-xs text-white/60">
                Estuviste #1 durante {stats.ranking.daysAsLeader} día{stats.ranking.daysAsLeader === 1 ? '' : 's'} en
                este rango.
              </p>
            )}
            <p className="text-xs text-white/50">{stats.comparison}</p>
            {!newModel && (
              <button onClick={() => openBid(id)} className="btn-gold w-full !py-3 text-sm">
                Mejorar mi posición
              </button>
            )}
          </section>

          {newModel && rankChecklist && (
            <section className="glass space-y-2.5 p-4">
              <h2 className="text-sm font-bold text-white">Cómo subir en el ranking</h2>
              <div className="flex items-center gap-3">
                <StarRating value={rankChecklist.ratingAvg} />
                <span className="text-xs text-white/50">
                  {rankChecklist.reviewsCount} reseña{rankChecklist.reviewsCount === 1 ? '' : 's'} ·{' '}
                  {rankChecklist.profileCompleteness}% de perfil completo
                </span>
              </div>
              <div className="space-y-1.5">
                {rankChecklist.checklist
                  .filter((c) => !c.done)
                  .map((c) => (
                    <div key={c.key} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-amber-300">○</span> {c.label}
                    </div>
                  ))}
                {rankChecklist.checklist.every((c) => c.done) && (
                  <p className="text-xs text-emerald-soft">✓ Tu perfil está 100% completo.</p>
                )}
              </div>
              {rankChecklist.checklist.some((c) => !c.done) && (
                <Link to="/perfil" className="btn-ghost block w-full text-center text-xs">
                  Completar mi perfil
                </Link>
              )}
              <a
                href={whatsappLink(
                  undefined,
                  `¡Gracias por preferirnos! ¿Nos ayudas con una reseña en Top? Te toma 30 segundos: https://www.top.com.do${rankChecklist.reviewLinkPath}`,
                )}
                target="_blank"
                rel="noreferrer"
                className="btn-gold block w-full !py-2.5 text-center text-xs"
              >
                💬 Pedir reseñas a mis clientes por WhatsApp
              </a>
            </section>
          )}

          <section className="glass space-y-2 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Actividad</h2>
              <div className="flex gap-1">
                {(Object.keys(METRIC_LABEL) as ChartMetric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`rounded-full border px-2 py-1 text-[10px] ${
                      metric === m ? 'border-gold/60 text-gold' : 'border-white/10 text-white/45'
                    }`}
                  >
                    {METRIC_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
            <ActivityChart data={chartData} />
          </section>

          <Link to="/perfil" className="btn-ghost block w-full text-center text-sm">
            ✎ Editar mi negocio (fotos, WhatsApp, redes, ubicación)
          </Link>

          <p className="px-1 text-center text-[11px] text-white/35">
            Top no garantiza clientes. Te ayudamos a ganar visibilidad y medimos las interacciones que los usuarios
            realizan con tu negocio.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="glass space-y-1 p-3.5">
      <div className="text-xl">{icon}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[11px] leading-tight text-white/45">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <b className="text-white">{value}</b>
    </div>
  );
}
