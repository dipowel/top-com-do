/**
 * Sellos de seguridad de pago (requisito de la validación de AZUL): Visa Secure y
 * Mastercard ID Check — llevan la marca Visa/Mastercard dentro, así que cumplen a la
 * vez "mostrar los logos de las marcas" y "conservar los sellos ya colocados".
 * Los SVG en `public/badges/` son recreaciones limpias; se pueden reemplazar por los
 * archivos oficiales de AZUL manteniendo el mismo nombre de archivo.
 */
const SEALS = [
  { src: '/badges/visa-secure.svg', alt: 'Visa Secure' },
  { src: '/badges/mastercard-idcheck.svg', alt: 'Mastercard ID Check' },
];

export default function SecurityBadges({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const h = variant === 'compact' ? 34 : 46;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SEALS.map((b) => (
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
