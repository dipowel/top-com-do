import { type FormEvent, type ReactNode } from 'react';
import { JOB_CATEGORY_DEFS } from '@shared/job-categories';
import { PROVINCE_DEFS } from '@shared/provinces';
import { citiesForProvince } from '@shared/cities';
import { JOB_TYPE_LABELS, WORK_MODE_LABELS, SALARY_PERIOD_LABELS } from '@shared/jobs';
import type { JobPostInput } from '@shared/types';

export interface JobFormValue {
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  companyId: string; // '' = ninguno
  companyName: string;
  category: string;
  province: string;
  city: string;
  locationText: string;
  jobType: string;
  workMode: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
  applicationUrl: string;
  applicationEmail: string;
  contactWhatsapp: string;
}

export const emptyJobForm: JobFormValue = {
  title: '',
  description: '',
  requirements: '',
  responsibilities: '',
  companyId: '',
  companyName: '',
  category: '',
  province: '',
  city: '',
  locationText: '',
  jobType: 'full_time',
  workMode: 'onsite',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'DOP',
  salaryPeriod: '',
  applicationUrl: '',
  applicationEmail: '',
  contactWhatsapp: '',
};

export function jobFormToPayload(v: JobFormValue, status: 'draft' | 'published'): JobPostInput {
  const n = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, '')) : null);
  const clean = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    requirements: clean(v.requirements),
    responsibilities: clean(v.responsibilities),
    companyId: v.companyId || null,
    companyName: v.companyName.trim(),
    category: v.category,
    province: clean(v.province),
    city: clean(v.city),
    locationText: clean(v.locationText),
    jobType: v.jobType,
    workMode: v.workMode,
    salaryMin: n(v.salaryMin),
    salaryMax: n(v.salaryMax),
    salaryCurrency: v.salaryCurrency,
    salaryPeriod: v.salaryPeriod || null,
    applicationUrl: v.applicationUrl.trim() ? normalizeUrl(v.applicationUrl) : undefined,
    applicationEmail: clean(v.applicationEmail),
    contactWhatsapp: clean(v.contactWhatsapp),
    status,
  };
}

function normalizeUrl(s: string): string {
  return /^https?:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim()}`;
}

const Label = ({ children }: { children: ReactNode }) => (
  <label className="text-xs text-white/50">{children}</label>
);

export default function JobForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy,
  error,
  myProfiles = [],
}: {
  value: JobFormValue;
  onChange: (v: JobFormValue) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  myProfiles?: { id: string; name: string }[];
}) {
  const set = (patch: Partial<JobFormValue>) => onChange({ ...value, ...patch });
  const cities = citiesForProvince(value.province || undefined);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Título del puesto</Label>
        <input
          required
          minLength={4}
          className="input mt-1"
          placeholder="Ej. Desarrollador Frontend"
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>

      <div>
        <Label>Descripción del empleo</Label>
        <textarea
          required
          rows={5}
          minLength={30}
          maxLength={8000}
          className="input mt-1"
          placeholder="Describe el puesto, el equipo y el día a día…"
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Requisitos (opcional)</Label>
          <textarea
            rows={3}
            maxLength={4000}
            className="input mt-1"
            placeholder="Experiencia, estudios, habilidades…"
            value={value.requirements}
            onChange={(e) => set({ requirements: e.target.value })}
          />
        </div>
        <div>
          <Label>Responsabilidades (opcional)</Label>
          <textarea
            rows={3}
            maxLength={4000}
            className="input mt-1"
            value={value.responsibilities}
            onChange={(e) => set({ responsibilities: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Categoría</Label>
          <select
            required
            className="input mt-1"
            value={value.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {JOB_CATEGORY_DEFS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <select className="input mt-1" value={value.jobType} onChange={(e) => set({ jobType: e.target.value })}>
              {Object.entries(JOB_TYPE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Modalidad</Label>
            <select className="input mt-1" value={value.workMode} onChange={(e) => set({ workMode: e.target.value })}>
              {Object.entries(WORK_MODE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass space-y-2 p-3">
        <Label>Ubicación</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className="input"
            value={value.province}
            onChange={(e) => set({ province: e.target.value, city: '' })}
          >
            <option value="">Provincia (opcional si es remoto)</option>
            {PROVINCE_DEFS.filter((p) => p.slug !== 'todo-rd').map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            list="job-cities"
            placeholder="Ciudad / municipio"
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
          />
          <datalist id="job-cities">
            {cities.map((c) => (
              <option key={c.slug} value={c.name} />
            ))}
          </datalist>
        </div>
        <input
          className="input"
          placeholder="Referencia (ej. Av. 27 de Febrero, cerca de…)"
          value={value.locationText}
          onChange={(e) => set({ locationText: e.target.value })}
        />
      </div>

      <div className="glass space-y-2 p-3">
        <Label>Salario (opcional — ayuda a recibir mejores candidatos)</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            className="input"
            inputMode="numeric"
            placeholder="Mínimo"
            value={value.salaryMin}
            onChange={(e) => set({ salaryMin: e.target.value })}
          />
          <input
            className="input"
            inputMode="numeric"
            placeholder="Máximo"
            value={value.salaryMax}
            onChange={(e) => set({ salaryMax: e.target.value })}
          />
          <select className="input" value={value.salaryCurrency} onChange={(e) => set({ salaryCurrency: e.target.value })}>
            <option value="DOP">RD$</option>
            <option value="USD">US$</option>
          </select>
          <select className="input" value={value.salaryPeriod} onChange={(e) => set({ salaryPeriod: e.target.value })}>
            <option value="">Periodo…</option>
            {Object.entries(SALARY_PERIOD_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass space-y-2 p-3">
        <Label>¿Cómo se aplica? (indica al menos una)</Label>
        <input
          className="input"
          placeholder="Enlace de aplicación (https://…)"
          value={value.applicationUrl}
          onChange={(e) => set({ applicationUrl: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            className="input"
            type="email"
            placeholder="Correo (rrhh@empresa.com)"
            value={value.applicationEmail}
            onChange={(e) => set({ applicationEmail: e.target.value })}
          />
          <input
            className="input"
            placeholder="WhatsApp (809…)"
            value={value.contactWhatsapp}
            onChange={(e) => set({ contactWhatsapp: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Publicar como</Label>
        {myProfiles.length > 0 && (
          <select
            className="input mt-1"
            value={value.companyId}
            onChange={(e) => {
              const p = myProfiles.find((x) => x.id === e.target.value);
              set({ companyId: e.target.value, companyName: p ? p.name : value.companyName });
            }}
          >
            <option value="">Otra empresa (escribe el nombre)</option>
            {myProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (mi negocio)
              </option>
            ))}
          </select>
        )}
        {!value.companyId && (
          <input
            required
            className="input mt-1"
            placeholder="Nombre de la empresa"
            value={value.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button disabled={busy} className="btn-gold w-full">
        {busy ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
