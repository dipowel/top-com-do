import { Link, useNavigate } from 'react-router-dom';
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
  hrefFor,
  nearbyActive = false,
  nearbyBusy = false,
  onNearby,
}: {
  value: string;
  /** URL destino de cada provincia (anclas reales, rastreables). */
  hrefFor: (slug: string) => string;
  /** El modo "Cerca de mí" está activo (ninguna provincia se ve seleccionada). */
  nearbyActive?: boolean;
  /** Se está pidiendo la ubicación al navegador. */
  nearbyBusy?: boolean;
  /** Click en el chip "📍 Cerca de mí". Si no se pasa, el chip no se renderiza. */
  onNearby?: () => void;
}) {
  const navigate = useNavigate();
  const featured = FEATURED.map((slug) => PROVINCE_DEFS.find((p) => p.slug === slug)).filter(
    (p): p is (typeof PROVINCE_DEFS)[number] => Boolean(p),
  );
  const rest = PROVINCE_DEFS.filter((p) => !FEATURED.includes(p.slug));
  const activeInRest = rest.find((p) => p.slug === value);
  const provActive = (slug: string) => !nearbyActive && value === slug;

  const [first, ...others] = featured;

  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1">
      {first && (
        <Link to={hrefFor(first.slug)} className={chipClass(provActive(first.slug))}>
          {first.name}
        </Link>
      )}

      {onNearby && (
        <button
          type="button"
          onClick={onNearby}
          aria-pressed={nearbyActive}
          className={chipClass(nearbyActive)}
        >
          {nearbyBusy ? '⏳ Ubicando…' : '📍 Cerca de mí'}
        </button>
      )}

      {others.map((p) => (
        <Link key={p.slug} to={hrefFor(p.slug)} className={chipClass(provActive(p.slug))}>
          {`📍 ${p.name}`}
        </Link>
      ))}

      <div className={`relative ${chipClass(!nearbyActive && Boolean(activeInRest))}`}>
        <span className="pointer-events-none">
          {activeInRest && !nearbyActive ? `📍 ${activeInRest.name}` : 'Más'} ▾
        </span>
        <select
          value={activeInRest && !nearbyActive ? value : ''}
          onChange={(e) => e.target.value && navigate(hrefFor(e.target.value))}
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
