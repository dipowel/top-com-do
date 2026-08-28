import { useEffect, type ReactNode } from 'react';

export default function Modal({
  title,
  children,
  onClose,
}: {
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  // Cerrar con la tecla Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija — el botón de cerrar nunca se pierde con el scroll */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h3 className="min-w-0 truncate text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gold/70 bg-white/10 text-xl leading-none text-white shadow-glow transition hover:bg-gold/25 active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}
