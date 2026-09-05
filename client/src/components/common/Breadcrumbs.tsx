import { Link } from 'react-router-dom';

export interface Crumb {
  name: string;
  to?: string;
}

/**
 * Migas de pan visibles. Deben reflejar el mismo camino que el `BreadcrumbList`
 * JSON-LD de `shared/seo.ts` (Google pide paridad entre ambos). El último ítem
 * es la página actual y va sin enlace.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Ruta de navegación" className="text-[11px] text-white/40">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.name}-${i}`} className="flex items-center gap-1">
              {c.to && !last ? (
                <Link to={c.to} className="hover:text-white/70">
                  {c.name}
                </Link>
              ) : (
                <span className={last ? 'text-white/60' : undefined} aria-current={last ? 'page' : undefined}>
                  {c.name}
                </span>
              )}
              {!last && <span aria-hidden className="text-white/25">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
