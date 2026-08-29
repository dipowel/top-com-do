import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../hooks/useSeo';
import { SITE_URL } from '@shared/site';

const UPDATED = '29 de agosto de 2026';

export default function LegalLayout({
  title,
  description,
  path,
  children,
}: {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
}) {
  useSeo({
    title: `${title} | Top.com.do`,
    description,
    canonical: `${SITE_URL}${path}`,
  });

  return (
    <article className="mx-auto max-w-2xl space-y-5 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-gold">{title}</h1>
        <p className="text-[11px] text-white/35">Última actualización: {UPDATED}</p>
      </header>

      <div className="space-y-5 text-sm leading-relaxed text-white/70 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white/90 [&_a]:text-gold [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_strong]:text-white/90">
        {children}
      </div>

      <footer className="border-t border-white/10 pt-4 text-xs text-white/40">
        <p className="mb-2 italic">
          Este documento es una plantilla informativa y no constituye asesoría legal. Antes de
          operar, hazlo revisar por un abogado en la República Dominicana.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/terminos">Términos</Link>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/normas">Normas</Link>
          <Link to="/">Volver al inicio</Link>
        </div>
      </footer>
    </article>
  );
}
