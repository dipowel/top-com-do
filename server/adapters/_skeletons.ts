/**
 * ESQUELETOS de fuentes que HOY no se pueden usar: sus Términos de Uso prohíben la
 * extracción/reutilización automatizada y/o su robots.txt bloquea el rastreo.
 * Cada uno lanza `SourceNotAuthorizedError`. Cuando exista una base legítima
 * (feed oficial, API con licencia, acuerdo escrito), se implementa `fetchJobs` y se
 * pone `job_sources.authorization_status='authorized'`.
 *
 * NO se debe: evadir bloqueos, rotar IPs, saltarse rate-limits ni mecanismos
 * anti-bot. Si una fuente no lo permite, no se fuerza.
 */
import type { ImportContext, JobSourceAdapter, RawJob } from './types';
import { SourceNotAuthorizedError } from './types';
import type { JobSource } from '../../shared/schema';

abstract class BlockedSource implements JobSourceAdapter {
  abstract readonly platform: string;
  abstract readonly displayName: string;
  readonly kind = 'feed' as const;
  protected abstract readonly reason: string;

  constructor(_source: JobSource) {}

  // eslint-disable-next-line require-yield
  async *fetchJobs(_ctx: ImportContext): AsyncIterable<RawJob> {
    throw new SourceNotAuthorizedError(this.platform, this.reason);
  }
}

export class LinkedInAdapter extends BlockedSource {
  readonly platform = 'linkedin';
  readonly displayName = 'LinkedIn Jobs';
  protected readonly reason =
    'El Acuerdo de Usuario de LinkedIn prohíbe el scraping. Vía legítima: LinkedIn Talent / ' +
    'Job Distribution partner, o que el empleador publique vía su ATS (Greenhouse/Lever).';
}

export class ComputrabajoAdapter extends BlockedSource {
  readonly platform = 'computrabajo';
  readonly displayName = 'Computrabajo RD';
  protected readonly reason =
    'Sus Términos prohíben reproducir/extraer su base de ofertas. Vía legítima: acuerdo de ' +
    'sindicación o feed oficial de Computrabajo.';
}

export class TecolocoAdapter extends BlockedSource {
  readonly platform = 'tecoloco';
  readonly displayName = 'Tecoloco RD';
  protected readonly reason =
    'Su contenido está "todos los derechos reservados". Vía legítima: acuerdo de contenido ' +
    'con Tecoloco / grupo propietario.';
}

export class TuNuevoTrabajoAdapter extends BlockedSource {
  readonly platform = 'tunuevotrabajo';
  readonly displayName = 'Tu Nuevo Trabajo';
  protected readonly reason =
    'Su robots.txt bloquea explícitamente a ClaudeBot/anthropic-ai y su pie dice "todos los ' +
    'derechos reservados". Vía legítima: permiso escrito o un feed que ellos provean.';
}
