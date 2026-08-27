export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/50">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
      {label ?? 'Cargando…'}
    </div>
  );
}
