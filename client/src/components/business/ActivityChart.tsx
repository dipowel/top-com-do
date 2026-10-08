interface Point {
  date: string; // YYYY-MM-DD
  value: number;
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function shortLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return WEEKDAY_SHORT[d.getDay()] ?? iso.slice(5);
}

/** Barras SVG simples, sin librería — legibles en móvil, sin ejes/rejillas de más. */
export default function ActivityChart({ data }: { data: Point[] }) {
  if (!data.length) {
    return <p className="py-6 text-center text-xs text-white/40">Sin actividad en este rango todavía.</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const showLabels = data.length <= 10;
  const w = 100;
  const h = 46;
  const gap = 1.2;
  const barW = (w - gap * (data.length - 1)) / data.length;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" preserveAspectRatio="none" role="img" aria-label="Actividad por día">
        {data.map((d, i) => {
          const barH = (d.value / max) * (h - 4);
          const x = i * (barW + gap);
          const y = h - barH - 4;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={Math.max(barH, 1)}
              rx={0.8}
              className={d.value > 0 ? 'fill-gold' : 'fill-white/10'}
            />
          );
        })}
      </svg>
      {showLabels && (
        <div className="mt-1 flex text-center text-[10px] text-white/40">
          {data.map((d) => (
            <div key={d.date} style={{ flex: 1 }}>
              {shortLabel(d.date)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
