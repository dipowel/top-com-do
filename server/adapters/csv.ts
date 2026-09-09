/**
 * Importador CSV curado. El operador (tú) sube un CSV de vacantes sobre las que
 * Top.com.do TIENE derechos (publicadas por acuerdo, propias, de clientes...).
 * `job_sources.config.csvUrl` apunta a un CSV público (o data URI).
 *
 * Cabeceras admitidas (flexible, en español o inglés):
 *   title|titulo, company|empresa, apply_url|url, description|descripcion,
 *   province|provincia, city|ciudad, category|categoria, salary_min, salary_max,
 *   salary_period, work_mode|modalidad, job_type|tipo, published_at, expires_at,
 *   street_address, postal_code, source_url, external_id|id
 */
import type { ImportContext, JobSourceAdapter, RawJob, SourceConfig } from './types';
import { SourceNotAuthorizedError } from './types';
import type { JobSource } from '../../shared/schema';

/** Parser CSV mínimo con soporte de comillas y saltos de línea internos. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      if (record.some((f) => f.trim() !== '')) rows.push(record);
      record = [];
    } else field += c;
  }
  if (field !== '' || record.length) {
    record.push(field);
    if (record.some((f) => f.trim() !== '')) rows.push(record);
  }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? '').trim()));
    return o;
  });
}

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k]) return r[k];
  return '';
};
const numOrNull = (v: string) => {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return v && Number.isFinite(n) ? Math.round(n) : null;
};

export class CsvImportAdapter implements JobSourceAdapter {
  readonly platform: string;
  readonly displayName: string;
  readonly kind = 'feed' as const;
  private url: string;

  constructor(source: JobSource) {
    const cfg = (source.config ?? {}) as SourceConfig;
    const url = cfg.csvUrl || source.feedUrl;
    if (!url) throw new SourceNotAuthorizedError(source.platform, 'falta config.csvUrl / feed_url');
    this.url = url;
    this.platform = source.platform;
    this.displayName = source.name;
  }

  async *fetchJobs(ctx: ImportContext): AsyncIterable<RawJob> {
    const res = await fetch(this.url, { signal: ctx.signal });
    if (!res.ok) throw new Error(`CSV ${this.url}: HTTP ${res.status}`);
    const rows = parseCsv(await res.text());
    let emitted = 0;
    for (const r of rows) {
      if (emitted >= ctx.maxJobs || Date.now() > ctx.deadline) return;
      const title = pick(r, 'title', 'titulo', 'puesto');
      const companyName = pick(r, 'company', 'empresa');
      if (!title || !companyName) continue;
      emitted++;
      yield {
        sourceJobId: pick(r, 'external_id', 'id') || `${title}|${companyName}`.toLowerCase(),
        sourceUrl: pick(r, 'source_url', 'sourceurl') || null,
        applyUrl: pick(r, 'apply_url', 'url', 'application_url') || null,
        applyEmail: pick(r, 'apply_email', 'email') || null,
        title,
        companyName,
        description: pick(r, 'description', 'descripcion') || null,
        requirements: pick(r, 'requirements', 'requisitos') || null,
        responsibilities: pick(r, 'responsibilities', 'responsabilidades') || null,
        province: pick(r, 'province', 'provincia') || null,
        city: pick(r, 'city', 'ciudad') || null,
        locationText: pick(r, 'location', 'ubicacion') || null,
        category: pick(r, 'category', 'categoria') || null,
        salaryMin: numOrNull(pick(r, 'salary_min', 'salario_min')),
        salaryMax: numOrNull(pick(r, 'salary_max', 'salario_max')),
        salaryPeriod: pick(r, 'salary_period', 'periodo') || null,
        salaryCurrency: pick(r, 'salary_currency', 'moneda') || null,
        workModeText: pick(r, 'work_mode', 'modalidad') || null,
        employmentType: pick(r, 'job_type', 'tipo') || null,
        streetAddress: pick(r, 'street_address', 'direccion') || null,
        postalCode: pick(r, 'postal_code', 'codigo_postal') || null,
        publishedAt: pick(r, 'published_at', 'fecha_publicacion') || null,
        expiresAt: pick(r, 'expires_at', 'fecha_expiracion') || null,
        raw: r,
      };
    }
  }
}

export { parseCsv };
