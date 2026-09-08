import { JOB_CATEGORY_DEFS } from '@shared/job-categories';
import { PROVINCE_DEFS } from '@shared/provinces';
import { WORK_MODE_LABELS, JOB_TYPE_LABELS } from '@shared/jobs';

export interface JobFilterState {
  category: string;
  province: string;
  workMode: string;
  jobType: string;
  salaryMin: string;
}

export const EMPTY_FILTERS: JobFilterState = {
  category: '',
  province: '',
  workMode: '',
  jobType: '',
  salaryMin: '',
};

const SALARY_STEPS = [
  { v: '', label: 'Cualquier salario' },
  { v: '15000', label: 'Desde RD$15,000' },
  { v: '25000', label: 'Desde RD$25,000' },
  { v: '40000', label: 'Desde RD$40,000' },
  { v: '60000', label: 'Desde RD$60,000' },
  { v: '100000', label: 'Desde RD$100,000' },
];

const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
    active ? 'border-gold/60 bg-gold/15 text-gold' : 'border-white/10 bg-white/5 text-white/55'
  }`;

export default function JobFilters({
  value,
  onChange,
}: {
  value: JobFilterState;
  onChange: (patch: Partial<JobFilterState>) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          className="input"
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {JOB_CATEGORY_DEFS.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={value.province}
          onChange={(e) => onChange({ province: e.target.value })}
          aria-label="Provincia"
        >
          <option value="">Todo el país</option>
          {PROVINCE_DEFS.filter((p) => p.slug !== 'todo-rd').map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={value.salaryMin}
          onChange={(e) => onChange({ salaryMin: e.target.value })}
          aria-label="Salario mínimo"
        >
          {SALARY_STEPS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          onClick={() => onChange({ workMode: '' })}
          className={chip(!value.workMode)}
        >
          Cualquier modalidad
        </button>
        {(Object.keys(WORK_MODE_LABELS) as (keyof typeof WORK_MODE_LABELS)[]).map((m) => (
          <button key={m} type="button" onClick={() => onChange({ workMode: m })} className={chip(value.workMode === m)}>
            {WORK_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button type="button" onClick={() => onChange({ jobType: '' })} className={chip(!value.jobType)}>
          Cualquier tipo
        </button>
        {(Object.keys(JOB_TYPE_LABELS) as (keyof typeof JOB_TYPE_LABELS)[]).map((t) => (
          <button key={t} type="button" onClick={() => onChange({ jobType: t })} className={chip(value.jobType === t)}>
            {JOB_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
