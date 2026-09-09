import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, API_BASE } from '../../lib/api';
import { track } from '../../lib/analytics';
import { useSeo } from '../../hooks/useSeo';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/common/Spinner';
import Breadcrumbs, { type Crumb } from '../../components/common/Breadcrumbs';
import RelatedJobs from '../../components/jobs/RelatedJobs';
import RichText from '../../components/jobs/RichText';
import { whatsappLink } from '../../lib/share';
import { jobPostingSeo, jobGoneSeo } from '@shared/seo';
import { jobCategoryLabel } from '@shared/job-categories';
import type { JobDetail, JobGone } from '@shared/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; job: JobDetail }
  | { kind: 'gone'; job: JobGone }
  | { kind: 'notfound' };

export default function EmpleoDetailPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setState({ kind: 'loading' });
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const data = res.status === 204 ? null : await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok) {
          setState({ kind: 'ok', job: data as JobDetail });
          track('job_view', { slug, category: (data as JobDetail)?.category });
        } else if (res.status === 410 && data?.gone) {
          setState({ kind: 'gone', job: data as JobGone });
        } else {
          setState({ kind: 'notfound' });
        }
      } catch {
        if (alive) setState({ kind: 'notfound' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const job = state.kind === 'ok' ? state.job : null;
  const goneJob = state.kind === 'gone' ? state.job : null;

  useSeo(
    job
      ? jobPostingSeo({
          slug: job.slug,
          title: job.title,
          description: job.description,
          companyId: job.companyId,
          companyName: job.companyName,
          category: job.category,
          province: job.province,
          provinceName: job.provinceName,
          city: job.city,
          jobType: job.jobType,
          workMode: job.workMode,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          salaryPeriod: job.salaryPeriod,
          publishedAt: job.publishedAt,
          expiresAt: job.expiresAt,
          streetAddress: job.streetAddress,
          postalCode: job.postalCode,
          applyUrl: job.applicationUrl,
          directApply: job.directApply,
          sourceName: job.sourceName,
          sourceUrl: job.sourceUrl,
          status: job.status,
        })
      : goneJob
        ? jobGoneSeo({ slug: goneJob.slug, title: goneJob.title, category: goneJob.category })
        : null,
  );

  if (state.kind === 'loading') return <Spinner />;
  if (state.kind === 'notfound')
    return (
      <div className="glass space-y-2 p-6 text-center text-sm text-white/60">
        <p>No encontramos esta vacante.</p>
        <Link to="/empleos" className="text-gold underline">
          Ver empleos activos
        </Link>
      </div>
    );

  if (goneJob) {
    return (
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { name: 'Inicio', to: '/' },
            { name: 'Empleos', to: '/empleos' },
            { name: jobCategoryLabel(goneJob.category) || 'Empleos', to: `/empleos/${goneJob.category}` },
            { name: goneJob.title },
          ]}
        />
        <div className="glass space-y-2 p-5">
          <h1 className="text-xl font-extrabold text-white">{goneJob.title}</h1>
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            ⚠️ Esta vacante ya no está disponible. La oferta fue retirada o expiró.
          </p>
          <Link to="/empleos" className="btn-gold inline-block text-sm">
            Ver empleos activos
          </Link>
        </div>
        <RelatedJobs jobs={goneJob.related} />
      </div>
    );
  }

  if (!job) return <Spinner />;

  const location = [job.city, job.provinceName].filter(Boolean).join(', ') || 'República Dominicana';
  const address = [job.streetAddress, job.postalCode].filter(Boolean).join(', ');
  const applyHref = job.applicationUrl
    ? job.applicationUrl
    : job.applicationEmail
      ? `mailto:${job.applicationEmail}?subject=${encodeURIComponent(`Aplicación: ${job.title}`)}`
      : null;
  const waHref = job.contactWhatsapp
    ? whatsappLink(job.contactWhatsapp, `Hola, me interesa la vacante "${job.title}" que vi en Top.com.do`)
    : null;
  const shareText = `💼 ${job.title} — ${job.companyName}\n📍 ${location}${
    job.salaryLabel ? `\n💰 ${job.salaryLabel}` : ''
  }\nhttps://www.top.com.do/empleo/${job.slug}`;
  const validThrough = job.expiresAt ? new Date(job.expiresAt).toLocaleDateString('es-DO') : null;
  const isExternal = job.sourcePlatform && job.sourcePlatform !== 'direct';

  const crumbs: Crumb[] = [
    { name: 'Inicio', to: '/' },
    { name: 'Empleos', to: '/empleos' },
    { name: jobCategoryLabel(job.category) || 'Empleos', to: `/empleos/${job.category}` },
    { name: job.title },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumbs items={crumbs} />

      <div className="glass space-y-2 p-4">
        <h1 className="text-xl font-extrabold text-white">{job.title}</h1>
        <div className="text-sm text-white/70">
          {job.companyId ? (
            <Link to={`/p/${job.companyId}`} className="text-gold underline">
              {job.companyName}
            </Link>
          ) : (
            job.companyName
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
          <span>📍 {location}</span>
          {job.salaryLabel && <span>💰 {job.salaryLabel}</span>}
          <span>🕐 {job.jobTypeLabel}</span>
          <span>🏢 {job.workModeLabel}</span>
        </div>
        {address && <p className="text-xs text-white/45">🏢 {address}</p>}
        {job.locationText && !address && <p className="text-xs text-white/45">📌 {job.locationText}</p>}
        {validThrough && <p className="text-xs text-white/45">⏳ Válido hasta el {validThrough}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {applyHref && (
          <a
            href={applyHref}
            {...(job.applicationUrl ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
            onClick={() => track('job_apply_click', { slug: job.slug })}
            className="btn-gold flex-1 whitespace-nowrap text-center text-sm"
          >
            Aplicar a esta vacante
          </a>
        )}
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('job_whatsapp_click', { slug: job.slug })}
            className="btn-emerald flex-1 whitespace-nowrap text-center text-sm"
          >
            Aplicar por WhatsApp
          </a>
        )}
        <a
          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('job_share', { slug: job.slug })}
          className="btn-ghost shrink-0 text-sm"
        >
          Compartir
        </a>
      </div>

      <section className="glass space-y-4 p-4 text-sm text-white/75">
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Sobre esta oportunidad</h2>
          <RichText html={job.description} className="text-sm text-white/75" />
        </div>
        {job.responsibilities && (
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Responsabilidades</h2>
            <RichText html={job.responsibilities} className="text-sm text-white/75" />
          </div>
        )}
        {job.requirements && (
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Requisitos</h2>
            <RichText html={job.requirements} className="text-sm text-white/75" />
          </div>
        )}

        <div className="border-t border-white/10 pt-3 text-[11px] text-white/40">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Información del empleo</h2>
          <ul className="space-y-0.5">
            <li>Modalidad: {job.workModeLabel}</li>
            <li>Tipo de contrato: {job.jobTypeLabel}</li>
            <li>Ubicación: {location}</li>
            {job.publishedAt && <li>Publicado: {new Date(job.publishedAt).toLocaleDateString('es-DO')}</li>}
            {validThrough && <li>Válido hasta: {validThrough}</li>}
          </ul>
        </div>

        {isExternal && (
          <p className="text-[11px] text-white/35">
            Fuente de la oferta: <span className="text-white/55">{job.sourceName || job.sourcePlatform}</span>
            {job.sourceUrl && (
              <>
                {' · '}
                <a href={job.sourceUrl} target="_blank" rel="nofollow noopener noreferrer" className="underline">
                  ver publicación original
                </a>
              </>
            )}
          </p>
        )}
      </section>

      {user && !reported && (
        <button
          onClick={async () => {
            const reason = window.prompt('¿Por qué reportas esta vacante? (spam, engañosa, ofensiva…)');
            if (!reason) return;
            try {
              await api(`/jobs/${job.id}/report`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason.slice(0, 60) }),
                auth: true,
              });
              setReported(true);
            } catch {
              /* ignore */
            }
          }}
          className="text-[11px] text-white/35 underline"
        >
          Reportar esta vacante
        </button>
      )}
      {reported && <p className="text-[11px] text-white/40">Gracias, revisaremos el reporte.</p>}

      <RelatedJobs jobs={job.related} />
    </div>
  );
}
