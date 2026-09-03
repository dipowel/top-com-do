export default function PujarAhoraButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Crea tu puja ahora"
      className="fixed bottom-[86px] left-1/2 z-50 -translate-x-1/2 rounded-full border-4 border-base px-5 py-3 text-[13px] font-extrabold text-black shadow-glow transition active:scale-95"
      style={{ backgroundImage: 'linear-gradient(135deg,#e8c874,#d4af37)' }}
    >
      ⚡ Crea tu puja ahora
    </button>
  );
}
