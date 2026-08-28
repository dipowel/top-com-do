import { useCategories } from '../../hooks/useCategories';

const FALLBACK = [{ slug: 'todo-rd', name: 'Todo RD' }];

export default function CategoryTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
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
        <button
          key={c.slug}
          onClick={() => onChange(c.slug)}
          className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            value === c.slug
              ? 'border-gold/60 bg-gold/15 text-gold'
              : 'border-white/10 bg-white/5 text-white/55 hover:text-white/80'
          }`}
        >
          {c.name}
        </button>
        ))}
      </div>
    </div>
  );
}
