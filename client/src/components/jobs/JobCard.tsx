import { Link } from 'react-router-dom';
import type { JobCard as Job } from '@shared/types';
import { avatarFallback } from '../../lib/share';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? '' : 'es'}`;
}

export default function JobCard({ job }: { job: Job }) {
  const location = [job.city, job.provinceName].filter(Boolean).join(', ') || 'República Dominicana';
  return (
    <Link
      to={`/empleo/${job.slug}`}
      className={`glass flex gap-3 p-3.5 transition hover:border-gold/40 ${
        job.isFeatured ? 'border border-gold/40' : ''
      }`}
    >
      {/* Logo real del negocio cuando existe; si no, ficha de iniciales — nunca una foto inventada. */}
      <img
        src={job.companyLogoUrl || avatarFallback(job.companyName)}
        alt=""
        width={52}
        height={52}
        loading="lazy"
        decoding="async"
        className="h-[52px] w-[52px] shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-white">{job.title}</div>
            <div className="truncate text-xs text-white/55">{job.companyName}</div>
          </div>
          {job.isFeatured && (
            <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
              ⭐ Destacado
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/50">
          <span>📍 {location}</span>
          {job.salaryLabel && <span>💰 {job.salaryLabel}</span>}
          <span>🕐 {job.jobTypeLabel}</span>
          <span>🏢 {job.workModeLabel}</span>
        </div>
        <div className="text-[10px] text-white/35">{timeAgo(job.publishedAt)}</div>
      </div>
    </Link>
  );
}
