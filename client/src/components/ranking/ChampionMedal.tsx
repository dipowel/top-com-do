/** Sello dorado del líder: medalla circular texturizada con borde de estrella y cintas. */

function serratedRing(cx: number, cy: number, rOuter: number, rInner: number, points: number): string {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

const RING = serratedRing(50, 50, 48, 41, 26);
const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

export default function ChampionMedal({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      role="img"
      aria-label="Puesto número 1"
      className={`h-12 w-12 shrink-0 drop-shadow-[0_0_16px_rgba(212,175,55,0.55)] sm:h-14 sm:w-14 ${className}`}
    >
      <defs>
        <linearGradient id="cm-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2d78d" />
          <stop offset="0.5" stopColor="#d4af37" />
          <stop offset="1" stopColor="#a9821f" />
        </linearGradient>
        <radialGradient id="cm-hi" cx="0.34" cy="0.28" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Cintas */}
      <path d="M34 80 L26 118 L43 105 L50 84 Z" fill="#b8942a" stroke="#7a5f14" strokeWidth="0.8" />
      <path d="M66 80 L74 118 L57 105 L50 84 Z" fill="#8a6d1f" stroke="#6a5212" strokeWidth="0.8" />

      {/* Borde de estrella */}
      <path d={RING} fill="url(#cm-gold)" stroke="#7a5f14" strokeWidth="1" />

      {/* Disco interior + textura */}
      <circle cx="50" cy="50" r="35" fill="url(#cm-gold)" stroke="#caa94b" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="35" fill="url(#cm-hi)" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="1" />

      <text
        x="50"
        y="35"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="11.5"
        fontWeight="800"
        letterSpacing="2"
        fill="#ffffff"
      >
        PUESTO
      </text>
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="33"
        fontWeight="900"
        fill="#ffffff"
      >
        #1
      </text>
    </svg>
  );
}
