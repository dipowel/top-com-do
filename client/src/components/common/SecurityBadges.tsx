/**
 * Marcas de pago aceptadas + sellos de seguridad. Requisito de la validación de AZUL:
 *  - Fila 1: marcas de aceptación Visa y Mastercard.
 *  - Fila 2: sellos 3D Secure (Visa Secure / Mastercard ID Check).
 * Los SVG en `public/badges/` son recreaciones limpias; se pueden reemplazar por los
 * archivos oficiales que entregó AZUL manteniendo el mismo nombre de archivo.
 */
const MARKS = [
  { src: '/badges/visa.svg', alt: 'Visa' },
  { src: '/badges/mastercard.svg', alt: 'Mastercard' },
];
const SECURE = [
  { src: '/badges/visa-secure.svg', alt: 'Visa Secure' },
  { src: '/badges/mastercard-idcheck.svg', alt: 'Mastercard ID Check' },
];

export default function SecurityBadges({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const h = variant === 'compact' ? 34 : 46;
  const row = (items: { src: string; alt: string }[]) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {items.map((b) => (
        <img
          key={b.src}
          src={b.src}
          alt={b.alt}
          width={h * 1.33}
          height={h}
          className="rounded-md bg-white/95 p-0.5"
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-2">
      {row(MARKS)}
      {row(SECURE)}
      {variant === 'full' && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-white/45">
          <span className="rounded-full border border-white/10 px-2 py-0.5">🔒 SSL / TLS</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5">AES-256</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5">PCI-DSS</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5">3D Secure</span>
        </div>
      )}
    </div>
  );
}
