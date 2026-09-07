import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../hooks/useSeo';
import { SITE_URL } from '@shared/site';
import { COMPANY } from '@shared/company';
import SecurityBadges from '../../components/common/SecurityBadges';

const ROWS: Array<{ label: string; value: ReactNode }> = [
  { label: 'Razón social', value: COMPANY.legalName },
  { label: COMPANY.taxIdLabel, value: COMPANY.taxId },
  { label: 'Dirección física', value: COMPANY.address.full },
  {
    label: 'Correo de soporte',
    value: (
      <a href={`mailto:${COMPANY.supportEmail}`} className="text-gold underline">
        {COMPANY.supportEmail}
      </a>
    ),
  },
  {
    label: 'Teléfono',
    value: (
      <a href={`tel:${COMPANY.phone}`} className="text-gold underline">
        {COMPANY.phoneDisplay}
      </a>
    ),
  },
  { label: 'Horario de atención', value: COMPANY.hours },
];

export default function ContactoPage() {
  useSeo({
    title: 'Contacto y datos del comercio | Top.com.do',
    description: `Datos de contacto y dirección permanente de ${COMPANY.legalName} (${COMPANY.brand}) en la República Dominicana: correo de soporte, teléfono y dirección física.`,
    canonical: `${SITE_URL}/contacto`,
  });

  return (
    <article className="mx-auto max-w-2xl space-y-6 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-gold">Contacto y datos del comercio</h1>
        <p className="text-sm text-white/60">
          {COMPANY.brand} es operado por {COMPANY.legalName}, en la República Dominicana.
        </p>
      </header>

      <dl className="glass divide-y divide-white/5 overflow-hidden rounded-2xl text-sm">
        {ROWS.map((r) => (
          <div key={r.label} className="grid grid-cols-1 gap-0.5 p-3 sm:grid-cols-3 sm:gap-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/40">
              {r.label}
            </dt>
            <dd className="text-white/80 sm:col-span-2">{r.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-white/45">
        Para consultas sobre pagos, reembolsos o seguridad, revisa primero{' '}
        <Link to="/devoluciones" className="text-gold underline">
          Devoluciones
        </Link>
        ,{' '}
        <Link to="/entrega" className="text-gold underline">
          Entrega
        </Link>{' '}
        y{' '}
        <Link to="/seguridad-pagos" className="text-gold underline">
          Seguridad de pagos
        </Link>
        .
      </p>

      <div className="flex justify-center border-t border-white/10 pt-5">
        <SecurityBadges />
      </div>
    </article>
  );
}
