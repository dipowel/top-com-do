import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { cleanName, directorioSeo } from '@shared/seo';
import { REAL_CATEGORY_DEFS, subcategoriesWithSlugsFor } from '@shared/categories';
import { PROVINCE_DEFS } from '@shared/provinces';
import Breadcrumbs from '../components/common/Breadcrumbs';

const PROVS = PROVINCE_DEFS.filter((p) => p.slug !== 'todo-rd');

/**
 * Hub de enlazado interno: reparte autoridad hacia las landings hiperlocales
 * (categoría, sub-rubro y provincia). Contenido estático, sin llamadas a la API.
 */
export default function DirectoryHubPage() {
  useSeo(directorioSeo());

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Breadcrumbs items={[{ name: 'Inicio', to: '/' }, { name: 'Directorio' }]} />
        <h1 className="text-xl font-extrabold">Directorio de negocios de la República Dominicana</h1>
        <p className="text-xs text-white/45">
          Negocios verificados por categoría, sub-rubro y provincia. Un solo líder por zona,
          actualizado en vivo.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white/85">Negocios por provincia</h2>
        <div className="flex flex-wrap gap-1.5">
          {PROVS.map((p) => (
            <Link
              key={p.slug}
              to={`/rd/todo-rd/${p.slug}`}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:text-white"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </section>

      {REAL_CATEGORY_DEFS.map((c) => {
        const subs = subcategoriesWithSlugsFor(c.slug);
        return (
          <section key={c.slug} className="space-y-2 border-t border-white/5 pt-4">
            <h2 className="text-sm font-extrabold text-white">
              <Link to={`/rd/${c.slug}`} className="hover:text-gold">
                {cleanName(c.name)}
              </Link>
            </h2>

            {subs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {subs.map((s) => (
                  <Link
                    key={s.slug}
                    to={`/explorar/${c.slug}/${s.slug}`}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55 hover:text-white"
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            )}

            <details className="text-xs text-white/50">
              <summary className="cursor-pointer text-white/40">Ver por provincia</summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PROVS.map((p) => (
                  <Link
                    key={p.slug}
                    to={`/rd/${c.slug}/${p.slug}`}
                    className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/45 hover:text-white"
                  >
                    {cleanName(c.name)} en {p.name}
                  </Link>
                ))}
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
