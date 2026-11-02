import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { guiasIndexSeo } from '@shared/seo';
import { GUIAS } from '@shared/guias';

export default function GuiasIndexPage() {
  useSeo(guiasIndexSeo());

  return (
    <div className="space-y-4">
      <header className="space-y-1.5 pt-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">📚 Guías para tu negocio</h1>
        <p className="text-sm text-white/60">
          Consejos prácticos y honestos para dueños de negocio en República Dominicana.
        </p>
      </header>
      <div className="space-y-2.5">
        {GUIAS.map((g) => (
          <Link key={g.slug} to={`/guias/${g.slug}`} className="glass block space-y-1 p-4 hover:border-gold/30">
            <h2 className="text-sm font-bold text-white">{g.title}</h2>
            <p className="text-xs text-white/55">{g.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
