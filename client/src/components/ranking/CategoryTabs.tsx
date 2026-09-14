import { Link } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';

const FALLBACK = [{ slug: 'todo-rd', name: '🔥 Todo RD' }];

/** Los nombres de categoría llevan un emoji-prefijo ("🍗 Gastronomía y Comida"); lo separamos
 *  para pintarlo como ícono de la tarjeta en vez de repetirlo dentro del texto. */
function splitEmoji(name: string): { icon: string; label: string } {
  const m = name.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
  return m && m[2] ? { icon: m[1]!, label: m[2] } : { icon: '🏷️', label: name };
}

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
        Explora los negocios líderes de cada sector
      </p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
        {list.map((c) => {
          const { icon, label } = splitEmoji(c.name);
          const active = value === c.slug;
          return (
            <Link
              key={c.slug}
              to={hrefFor(c.slug)}
              className={`flex w-[74px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-1.5 py-2.5 text-center transition ${
                active
                  ? 'border-gold/60 bg-gold/10 text-gold'
                  : 'border-white/10 bg-white/5 text-white/55 hover:text-white/80'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden>
                {icon}
              </span>
              <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
