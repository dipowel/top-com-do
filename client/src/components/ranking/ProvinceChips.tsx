import { PROVINCE_DEFS } from '@shared/provinces';

/** Provincias destacadas como chips; el resto vive en el chip "Más ▾". */
const FEATURED = [
  'todo-rd',
  'distrito-nacional',
  'santo-domingo',
  'santiago',
  'la-altagracia',
  'la-vega',
];

const chipClass = (active: boolean) =>
  `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
    active
      ? 'border-gold/60 bg-gold/15 text-gold'
      : 'border-white/10 bg-white/5 text-white/55 hover:text-white/80'
  }`;

export default function ProvinceChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const featured = FEATURED.map((slug) => PROVINCE_DEFS.find((p) => p.slug === slug)).filter(
    (p): p is (typeof PROVINCE_DEFS)[number] => Boolean(p),
  );
  const rest = PROVINCE_DEFS.filter((p) => !FEATURED.includes(p.slug));
  const activeInRest = rest.find((p) => p.slug === value);

  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1">
      {featured.map((p) => (
        <button
          key={p.slug}
          type="button"
          onClick={() => onChange(p.slug)}
          className={chipClass(value === p.slug)}
        >
          {p.slug === 'todo-rd' ? p.name : `📍 ${p.name}`}
        </button>
      ))}

      <div className={`relative ${chipClass(Boolean(activeInRest))}`}>
        <span className="pointer-events-none">
          {activeInRest ? `📍 ${activeInRest.name}` : 'Más'} ▾
        </span>
        <select
          value={activeInRest ? value : ''}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Más provincias"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          <option value="" disabled>
            Elige una provincia
          </option>
          {rest.map((p) => (
            <option key={p.slug} value={p.slug} className="bg-base text-white">
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
