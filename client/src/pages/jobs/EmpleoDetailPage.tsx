import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import { useSeo } from '../../hooks/useSeo';
import { useAuth } from '../../hooks/useAuth';
import Spinner from '../../components/common/Spinner';
import Breadcrumbs, { type Crumb } from '../../components/common/Breadcrumbs';
import RelatedJobs from '../../components/jobs/RelatedJobs';
import { whatsappLink } from '../../lib/share';
import { jobPostingSeo } from '@shared/seo';
import { jobCategoryLabel } from '@shared/job-categories';
import type { JobDetail } from '@shared/types';

export default function EmpleoDetailPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setJob(null);
    setNotFound(false);
    api<JobDetail>(`/jobs/${slug}`)
      .then((j) => {
        setJob(j);
        track('job_view', { slug: j.slug, category: j.category });
      })
      .catch(() => setNotFound(true));
  }, [slug]);

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
        })
      : null,
  );

  if (notFound) return <p className="text-sm text-white/50">Vacante no encontrada o ya cerrada.</p>;
  if (!job) return <Spinner />;

  const location = [job.city, job.provinceName].filter(Boolean).join(', ') || 'República Dominicana';
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
        {job.locationText && <p className="text-xs text-white/45">📌 {job.locationText}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {applyHref && (
          <a
            href={applyHref}
            {...(job.applicationUrl ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
            onClick={() => track('job_apply_click', { slug: job.slug })}
            className="btn-gold flex-1 whitespace-nowrap text-center text-sm"
          >
            Aplicar ahora
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

      <section className="glass space-y-3 p-4 text-sm text-white/75">
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Descripción</h2>
          <p className="whitespace-pre-wrap">{job.description}</p>
        </div>
        {job.responsibilities && (
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Responsabilidades</h2>
            <p className="whitespace-pre-wrap">{job.responsibilities}</p>
          </div>
        )}
        {job.requirements && (
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white/40">Requisitos</h2>
            <p className="whitespace-pre-wrap">{job.requirements}</p>
          </div>
        )}
        <p className="text-[11px] text-white/35">
          Publicado{job.publishedAt ? ` el ${new Date(job.publishedAt).toLocaleDateString('es-DO')}` : ''}
          {job.expiresAt ? ` · vence el ${new Date(job.expiresAt).toLocaleDateString('es-DO')}` : ''}
        </p>
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
