import { Link, Navigate, useParams } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { guiaSeo } from '@shared/seo';
import { getGuia } from '@shared/guias';
import Breadcrumbs from '../components/common/Breadcrumbs';

export default function GuiaDetailPage() {
  const { slug = '' } = useParams();
  const guia = getGuia(slug);
  const seo = guia ? guiaSeo(slug) : null;
  useSeo(seo);

  if (!guia) return <Navigate to="/guias" replace />;

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ name: 'Inicio', to: '/' }, { name: 'Guías', to: '/guias' }, { name: guia.title }]} />
      <header className="space-y-1.5 pt-1">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white">{guia.title}</h1>
        <p className="text-[11px] text-white/35">
          Actualizado el {new Date(guia.updatedAt).toLocaleDateString('es-DO')} · Equipo Top
        </p>
      </header>
      <article className="glass space-y-3 p-4">
        {guia.blocks.map((b, i) =>
          b.type === 'h2' ? (
            <h2 key={i} className="text-base font-bold text-gold">
              {b.text}
            </h2>
          ) : (
            <p key={i} className="text-sm leading-relaxed text-white/70">
              {b.text}
            </p>
          ),
        )}
      </article>
      <section className="glass flex flex-col items-center gap-2 border border-gold/30 p-4 text-center">
        <p className="text-sm font-bold text-gold">¿Tu negocio no aparece en Top todavía?</p>
        <Link to="/registrar-negocio" className="btn-gold !px-5 !py-2.5 text-sm">
          Regístralo gratis
        </Link>
      </section>
      <Link to="/guias" className="block text-center text-xs text-gold underline">
        ← Ver todas las guías
      </Link>
    </div>
  );
}
