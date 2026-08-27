export function CrownBadge() {
  return (
    <span title="Líder de la ronda" className="text-base leading-none">
      👑
    </span>
  );
}

export function PositionBadge({ position, champion }: { position: number; champion?: boolean }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
        champion
          ? 'bg-gold text-black'
          : position <= 3
            ? 'bg-white/15 text-white'
            : 'bg-white/5 text-white/60'
      }`}
    >
      {position}
    </div>
  );
}
