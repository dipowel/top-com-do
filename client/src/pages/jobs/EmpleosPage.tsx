import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import { useSeo } from '../../hooks/useSeo';
import Spinner from '../../components/common/Spinner';
import Breadcrumbs, { type Crumb } from '../../components/common/Breadcrumbs';
import JobCard from '../../components/jobs/JobCard';
import JobFilters, { EMPTY_FILTERS, type JobFilterState } from '../../components/jobs/JobFilters';
import { empleosSeo } from '@shared/seo';
import { isJobCategory, jobCategoryLabel } from '@shared/job-categories';
import { isRealProvince, provinceName, PROVINCE_DEFS } from '@shared/provinces';

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function matchProvince(text: string): string {
  const n = norm(text);
  if (!n) return '';
  return PROVINCE_DEFS.find((p) => p.slug !== 'todo-rd' && norm(p.name).includes(n))?.slug ?? '';
}
import type { JobCard as Job, JobsListResponse } from '@shared/types';

export default function EmpleosPage() {
  const { filtro, provincia } = useParams();
  const [sp, setSp] = useSearchParams();

  // Filtro que viene de la ruta (landing SSR) tiene prioridad sobre el query.
  const routeCategory = isJobCategory(filtro) ? filtro! : '';
  const routeProvince = isRealProvince(provincia) ? provincia! : isRealProvince(filtro) && !routeCategory ? filtro! : '';

  const [q, setQ] = useState(sp.get('q') ?? '');
  const [where, setWhere] = useState(sp.get('donde') ?? (routeProvince ? provinceName(routeProvince) : ''));
  const [filters, setFilters] = useState<JobFilterState>({
    ...EMPTY_FILTERS,
    category: routeCategory || sp.get('categoria') || '',
    province: routeProvince || sp.get('provincia') || '',
    workMode: sp.get('modalidad') || '',
    jobType: sp.get('tipo') || '',
    salaryMin: sp.get('salario') || '',
  });

  const [items, setItems] = useState<Job[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  const buildParams = useCallback(
    (c?: string | null) => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (filters.category) p.set('category', filters.category);
      if (filters.province) p.set('province', filters.province);
      if (filters.workMode) p.set('modalidad', filters.workMode);
      if (filters.jobType) p.set('tipo', filters.jobType);
      if (filters.salaryMin) p.set('salario', filters.salaryMin);
      if (c) p.set('cursor', c);
      return p;
    },
    [q, filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<JobsListResponse>(`/jobs?${buildParams()}`);
      setItems(res.items);
      setCursor(res.nextCursor);
    } catch {
      setItems([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Debounce de búsqueda + filtros.
  useEffect(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(load, 300);
    return () => window.clearTimeout(debounce.current);
  }, [load]);

  // Sincroniza los filtros con el query (para compartir) sin ensuciar canonical.
  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (!routeCategory && filters.category) next.set('categoria', filters.category);
    if (!routeProvince && filters.province) next.set('provincia', filters.province);
    if (filters.workMode) next.set('modalidad', filters.workMode);
    if (filters.jobType) next.set('tipo', filters.jobType);
    if (filters.salaryMin) next.set('salario', filters.salaryMin);
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await api<JobsListResponse>(`/jobs?${buildParams(cursor)}`);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  // ---- SEO: canonical siempre a la ruta limpia más cercana ----
  const cleanCategory = filters.category && isJobCategory(filters.category) ? filters.category : null;
  const cleanProvince = filters.province && isRealProvince(filters.province) ? filters.province : null;
  const onlyCleanFilters = !q.trim() && !filters.workMode && !filters.jobType && !filters.salaryMin;
  const seoCategory = onlyCleanFilters ? cleanCategory : null;
  const seoProvince = onlyCleanFilters ? cleanProvince : null;

  useSeo(
    empleosSeo({
      categorySlug: seoCategory,
      provinceSlug: seoProvince,
      items: items.slice(0, 20).map((j) => ({ slug: j.slug, title: j.title })),
      // El SSR aplica el guard real; en cliente sólo evitamos indexar combinaciones con filtros libres.
      indexable: onlyCleanFilters,
    }),
  );

  const crumbs: Crumb[] = useMemo(() => {
    const c: Crumb[] = [
      { name: 'Inicio', to: '/' },
      { name: 'Empleos', to: '/empleos' },
    ];
    if (seoCategory) c.push({ name: jobCategoryLabel(seoCategory), to: `/empleos/${seoCategory}` });
    if (seoProvince) c.push({ name: provinceName(seoProvince) });
    return c;
  }, [seoCategory, seoProvince]);

  const heading = seoCategory
    ? `Empleos de ${jobCategoryLabel(seoCategory)}${seoProvince ? ` en ${provinceName(seoProvince)}` : ''}`
    : seoProvince
      ? `Empleos en ${provinceName(seoProvince)}`
      : 'Empleos en República Dominicana';

  return (
    <div className="space-y-4">
      {crumbs.length > 2 && <Breadcrumbs items={crumbs} />}
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">💼 {heading}</h1>
        <p className="text-sm text-white/55">
          Encuentra oportunidades cerca de ti — o{' '}
          <Link to="/empleos/publicar" className="text-gold underline">
            publica tu vacante gratis
          </Link>
          .
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="input"
          placeholder="¿Qué trabajo buscas?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar empleo"
        />
        <input
          className="input"
          placeholder="¿Dónde? (ciudad o provincia)"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          aria-label="Ubicación"
        />
        <button
          onClick={() => {
            const prov = matchProvince(where);
            if (prov) setFilters((f) => ({ ...f, province: prov }));
            track('job_search', { q: q.trim().slice(0, 40) || 'vacio' });
            load();
          }}
          className="btn-gold whitespace-nowrap"
        >
          🔎 Buscar
        </button>
      </div>

      <JobFilters
        value={filters}
        onChange={(patch) => {
          setFilters((f) => ({ ...f, ...patch }));
          track('job_filter', { field: Object.keys(patch)[0] ?? 'n/a' });
        }}
      />

      {loading && !items.length ? (
        <Spinner />
      ) : !items.length ? (
        <div className="glass p-6 text-center text-sm text-white/55">
          No encontramos vacantes con esos criterios.{' '}
          <Link to="/empleos/publicar" className="text-gold underline">
            ¿Tienes una? Publícala gratis
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {items.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}

      {cursor && (
        <button onClick={loadMore} disabled={loadingMore} className="btn-ghost w-full text-sm">
          {loadingMore ? 'Cargando…' : 'Ver más empleos'}
        </button>
      )}

      <section className="glass flex flex-col gap-2 border border-gold/25 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-extrabold text-white">¿Tienes una vacante?</div>
          <p className="text-xs text-white/55">Publícala gratis y llega a candidatos en toda la RD.</p>
        </div>
        <Link to="/empleos/publicar" className="btn-gold shrink-0 whitespace-nowrap !py-2.5 text-xs">
          Publicar vacante gratis
        </Link>
      </section>
    </div>
  );
}
