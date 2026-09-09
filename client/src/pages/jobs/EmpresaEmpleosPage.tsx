import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { useSeo } from '../../hooks/useSeo';
import Spinner from '../../components/common/Spinner';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import JobCard from '../../components/jobs/JobCard';
import { SITE_URL } from '@shared/site';
import type { JobCard as Job } from '@shared/types';

interface CompanyJobs {
  companyName: string;
  province: string | null;
  jobs: Job[];
}

export default function EmpresaEmpleosPage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<CompanyJobs | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'empty'>('loading');

  useEffect(() => {
    setState('loading');
    let alive = true;
    fetch(`${API_BASE}/jobs/empresa/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as CompanyJobs) : null))
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState(d && d.jobs.length ? 'ok' : 'empty');
      })
      .catch(() => alive && setState('empty'));
    return () => {
      alive = false;
    };
  }, [slug]);

  useSeo(
    data
      ? {
          title: `Empleos en ${data.companyName} | Top.com.do`.slice(0, 110),
          description: `${data.jobs.length} vacante${data.jobs.length === 1 ? '' : 's'} activa${
            data.jobs.length === 1 ? '' : 's'
          } en ${data.companyName}. Postúlate directo en Top.com.do.`,
          canonical: `${SITE_URL}/empleos/empresa/${slug}`,
          noindex: data.jobs.length < 3,
        }
      : null,
  );

  if (state === 'loading') return <Spinner />;
  if (state === 'empty' || !data)
    return (
      <div className="glass space-y-2 p-6 text-center text-sm text-white/60">
        <p>Esta empresa no tiene vacantes activas ahora mismo.</p>
        <Link to="/empleos" className="text-gold underline">
          Ver todos los empleos
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { name: 'Inicio', to: '/' },
          { name: 'Empleos', to: '/empleos' },
          { name: data.companyName },
        ]}
      />
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Empleos en {data.companyName}</h1>
        <p className="text-sm text-white/55">
          {data.jobs.length} vacante{data.jobs.length === 1 ? '' : 's'} activa{data.jobs.length === 1 ? '' : 's'}.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {data.jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </div>
  );
}
