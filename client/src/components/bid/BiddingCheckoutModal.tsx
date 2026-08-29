import { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDOP } from '../../lib/format';
import { BID_TIERS_DOP, type BidTier } from '@shared/bidding';

/**
 * Checkout de una puja: elige nivel fijo, acepta los términos y paga con
 * Dodo Payments (o con saldo por referidos si alcanza).
 */
export default function BiddingCheckoutModal({
  profileId,
  profileName,
  categoryName,
  provinceName,
  suggestedDop,
  onClose,
  onPaidWithCredit,
}: {
  profileId: string;
  profileName?: string;
  categoryName?: string;
  provinceName?: string;
  suggestedDop?: number;
  onClose: () => void;
  onPaidWithCredit?: () => void;
}) {
  const { me } = useAuth();
  const credit = me?.creditBalanceDop ?? 0;

  const defaultTier = useMemo<BidTier>(() => {
    if (!suggestedDop) return BID_TIERS_DOP[0];
    return BID_TIERS_DOP.find((t) => t >= suggestedDop) ?? BID_TIERS_DOP[BID_TIERS_DOP.length - 1];
  }, [suggestedDop]);

  const [tier, setTier] = useState<BidTier>(defaultTier);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState<null | 'dodo' | 'credit'>(null);
  const [error, setError] = useState<string | null>(null);
  const [okCredit, setOkCredit] = useState(false);

  const canUseCredit = credit >= tier;

  async function payWithDodo() {
    setError(null);
    setLoading('dodo');
    try {
      const { url } = await api<{ url: string }>('/checkout/dodo', {
        method: 'POST',
        body: JSON.stringify({ profileId, tier }),
        auth: true,
      });
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  async function payWithCredit() {
    setError(null);
    setLoading('credit');
    try {
      await api('/bids', {
        method: 'POST',
        body: JSON.stringify({ profileId, method: 'credit', amount: tier, currency: 'DOP' }),
        auth: true,
      });
      setOkCredit(true);
      onPaidWithCredit?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  if (okCredit) {
    return (
      <Modal onClose={onClose} title="¡Puja registrada!">
        <div className="space-y-3 py-4 text-center">
          <div className="text-4xl">🎉</div>
          <p className="font-bold">Pagaste {formatDOP(tier)} con tu saldo</p>
          <p className="text-sm text-white/60">Tu puja ya cuenta en el ranking.</p>
          <button onClick={onClose} className="btn-gold w-full">
            Ver ranking
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Confirmar puja">
      <div className="space-y-4">
        <div className="glass p-3 text-sm">
          <div className="font-bold">{profileName || 'Perfil seleccionado'}</div>
          <div className="mt-0.5 text-xs text-white/45">
            {[categoryName, provinceName].filter(Boolean).join(' · ') || 'Directorio Top.com.do'}
          </div>
        </div>

        {suggestedDop != null && (
          <p className="text-[11px] text-white/45">
            Para tomar el <b>#1</b> ahora mismo necesitas al menos{' '}
            <b className="text-gold">{formatDOP(suggestedDop)}</b> acumulados.
          </p>
        )}

        <div>
          <label className="text-xs text-white/50">Nivel de la puja</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {BID_TIERS_DOP.map((t) => {
              const leads = suggestedDop == null || t >= suggestedDop;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`rounded-xl border p-3 text-left text-sm ${
                    tier === t ? 'border-gold/60 bg-gold/10' : 'border-white/10'
                  }`}
                >
                  <span className="block font-bold">{formatDOP(t)}</span>
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      leads ? 'text-emerald-soft' : 'text-white/35'
                    }`}
                  >
                    {leads ? '✓ toma el #1' : 'no alcanza el #1'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass flex items-center justify-between p-3 text-sm">
          <span className="text-white/50">Total a pagar</span>
          <b className="text-lg text-gold">{formatDOP(tier)}</b>
        </div>

        <label className="flex items-start gap-2 text-[12px] leading-snug text-white/70">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
          />
          <span>
            He leído y acepto los{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline">
              Términos de Servicio
            </a>
            , la{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline">
              Política de Privacidad
            </a>{' '}
            y las{' '}
            <a href="/normas" target="_blank" rel="noopener noreferrer" className="underline">
              Normas
            </a>{' '}
            de top.com.do.
          </span>
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={payWithDodo}
          disabled={!accepted || loading !== null}
          className="btn-gold w-full"
        >
          {loading === 'dodo' ? 'Redirigiendo…' : 'Pagar con Dodo Payments'}
        </button>

        {credit > 0 && (
          <button
            onClick={payWithCredit}
            disabled={!accepted || !canUseCredit || loading !== null}
            className="btn-ghost w-full text-xs"
          >
            {loading === 'credit'
              ? 'Procesando…'
              : canUseCredit
                ? `Pagar con mi saldo (${formatDOP(credit)} disponible)`
                : `Saldo insuficiente (${formatDOP(credit)})`}
          </button>
        )}

        <p className="text-center text-[10px] text-white/30">
          El pago se procesa de forma segura por Dodo Payments. Las pujas por el #1 son
          definitivas y no reembolsables una vez procesadas.
        </p>
      </div>
    </Modal>
  );
}
