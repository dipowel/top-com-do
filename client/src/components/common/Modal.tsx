import type { ReactNode } from 'react';

export default function Modal({
  title,
  children,
  onClose,
}: {
  title?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-8 sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
