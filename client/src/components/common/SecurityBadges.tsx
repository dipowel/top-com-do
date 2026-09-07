/**
 * Sellos de seguridad de pago: 3D Secure (Visa Secure / Mastercard ID Check) +
 * chips de cumplimiento. Requisito de la validación de AZUL. Los SVG en
 * `public/badges/` son recreaciones limpias; reemplázalos por los oficiales
 * cuando AZUL/Visa/Mastercard los entreguen.
 */
export default function SecurityBadges({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const size = variant === 'compact' ? 40 : 52;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <img
          src="/badges/visa-secure.svg"
          alt="Visa Secure"
          width={size * 1.33}
          height={size}
          className="rounded-md bg-white/95 p-0.5"
          loading="lazy"
          decoding="async"
        />
        <img
          src="/badges/mastercard-idcheck.svg"
          alt="Mastercard ID Check"
          width={size * 1.33}
          height={size}
          className="rounded-md bg-white/95 p-0.5"
          loading="lazy"
          decoding="async"
        />
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
