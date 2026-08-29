/** Estrellas de solo lectura (admite medias). */
export function StarRating({ value, size = 'text-sm' }: { value: number; size?: string }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 ${size} leading-none`} aria-label={`${value} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < full ? 'text-gold' : i === full && half ? 'text-gold/60' : 'text-white/20'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Selector de estrellas 1–5. */
export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          className={`text-2xl leading-none transition active:scale-90 ${
            n <= value ? 'text-gold' : 'text-white/25 hover:text-white/50'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
