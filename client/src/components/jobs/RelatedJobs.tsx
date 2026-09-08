import type { JobCard as Job } from '@shared/types';
import JobCard from './JobCard';

export default function RelatedJobs({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-white/85">También te puede interesar</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
  );
}
