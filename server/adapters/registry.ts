/**
 * Registro de adaptadores por `platform`. `buildAdapter` lanza si la plataforma no
 * tiene adaptador o si la fuente no está autorizada.
 *
 * `IMPORT_ENABLED` (env, default 'false') es el interruptor maestro: mientras esté
 * apagado, NINGUNA fuente externa se ejecuta (la publicación directa no pasa por aquí).
 */
import type { JobSource } from '../../shared/schema';
import type { BuildAdapter, JobSourceAdapter } from './types';
import { SourceNotAuthorizedError } from './types';
import { GreenhouseAdapter } from './greenhouse';
import { LeverAdapter } from './lever';
import { CsvImportAdapter } from './csv';
import { JoobleAdapter } from './jooble';
import {
  LinkedInAdapter,
  ComputrabajoAdapter,
  TecolocoAdapter,
  TuNuevoTrabajoAdapter,
} from './_skeletons';

export const importEnabled = () =>
  String(process.env.IMPORT_ENABLED || '').toLowerCase() === 'true';

/** platform → constructor. `direct` no está: sus ofertas entran por `POST /api/jobs`. */
const REGISTRY: Record<string, BuildAdapter> = {
  greenhouse: (s) => new GreenhouseAdapter(s),
  lever: (s) => new LeverAdapter(s),
  csv: (s) => new CsvImportAdapter(s),
  jooble: (s) => new JoobleAdapter(s),
  linkedin: (s) => new LinkedInAdapter(s),
  computrabajo: (s) => new ComputrabajoAdapter(s),
  tecoloco: (s) => new TecolocoAdapter(s),
  tunuevotrabajo: (s) => new TuNuevoTrabajoAdapter(s),
};

export function hasAdapter(platform: string): boolean {
  return platform in REGISTRY;
}

export function buildAdapter(source: JobSource): JobSourceAdapter {
  if (!importEnabled()) {
    throw new SourceNotAuthorizedError(source.platform, 'IMPORT_ENABLED=false (ingesta externa desactivada)');
  }
  const make = REGISTRY[source.platform];
  if (!make) throw new SourceNotAuthorizedError(source.platform, 'sin adaptador registrado');
  if (source.authorizationStatus !== 'authorized' || !source.isEnabled) {
    throw new SourceNotAuthorizedError(
      source.platform,
      `job_sources debe tener authorization_status='authorized' e is_enabled=true`,
    );
  }
  return make(source);
}
