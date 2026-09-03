import { Link } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';

const FALLBACK = [{ slug: 'todo-rd', name: 'Todo RD' }];

export default function CategoryTabs({
  value,
  hrefFor,
}: {
  value: string;
  /** URL destino de cada rubro (anclas reales, rastreables por buscadores). */
  hrefFor: (slug: string) => string;
}) {
  const cats = useCategories();
  const list = cats.length ? cats : FALLBACK;

  return (
    <div>
      <p className="mb-1.5 text-[11px] text-white/40">
        Elige tu rubro — el #1 aparece de primero cuando te buscan
      </p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
        {list.map((c) => (
          <Link
            key={c.slug}
            to={hrefFor(c.slug)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              value === c.slug
                ? 'border-gold/60 bg-gold/15 text-gold'
                : 'border-white/10 bg-white/5 text-white/55 hover:text-white/80'
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
