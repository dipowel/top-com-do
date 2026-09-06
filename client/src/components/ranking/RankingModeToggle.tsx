export type RankingMode = 'global' | 'nearby';

/**
 * Selector de modo de ranking. `Todo RD` = ranking económico actual (estado por
 * defecto, coherente con el SSR). `Cerca de mí` = re-orden por puja + proximidad,
 * solo tras permiso de ubicación. Accesible: grupo con `aria-pressed`, foco
 * visible, iconos + texto (no depende del color), touch target ≥ 44 px.
 */
export default function RankingModeToggle({
  mode,
  onChange,
  busy = false,
}: {
  mode: RankingMode;
  onChange: (m: RankingMode) => void;
  busy?: boolean;
}) {
  const base =
    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ' +
    'min-h-[44px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

  return (
    <div
      role="group"
      aria-label="Modo de ranking"
      className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
    >
      <button
        type="button"
        aria-pressed={mode === 'global'}
        onClick={() => onChange('global')}
        className={`${base} ${
          mode === 'global'
            ? 'border border-gold/60 bg-gold/15 text-gold focus-visible:outline-gold'
            : 'text-white/55 hover:text-white/85 focus-visible:outline-white/40'
        }`}
      >
        <span aria-hidden>🌎</span> Todo RD
      </button>
      <button
        type="button"
        aria-pressed={mode === 'nearby'}
        aria-busy={busy || undefined}
        onClick={() => onChange('nearby')}
        className={`${base} ${
          mode === 'nearby'
            ? 'border border-[#f7b924] bg-[#f7b924]/15 text-[#f7b924] focus-visible:outline-[#f7b924]'
            : 'text-white/55 hover:text-white/85 focus-visible:outline-white/40'
        }`}
      >
        <span aria-hidden>{busy ? '⏳' : '📍'}</span>
        {busy ? 'Ubicando…' : 'Cerca de mí'}
      </button>
    </div>
  );
}
