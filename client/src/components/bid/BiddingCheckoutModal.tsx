import { useState } from 'react';
import Modal from '../common/Modal';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDOP } from '../../lib/format';

/**
 * Checkout de una puja (subasta dinámica): el usuario oferta un monto libre que
 * debe superar al #1 de su categoría × provincia, acepta los términos y paga con
 * Dodo Payments (o con saldo por referidos si alcanza).
 */
export default function BiddingCheckoutModal({
  profileId,
  profileName,
  categoryName,
  provinceName,
  minBidDop,
  leaderTotalDop,
  myTotalDop,
  onClose,
  onPaidWithCredit,
}: {
  profileId: string;
  profileName?: string;
  categoryName?: string;
  provinceName?: string;
  minBidDop: number;
  leaderTotalDop?: number;
  myTotalDop?: number;
  onClose: () => void;
  onPaidWithCredit?: () => void;
}) {
  const { me } = useAuth();
  const credit = me?.creditBalanceDop ?? 0;

  const min = Math.max(Math.round(minBidDop), 100);
  const [amount, setAmount] = useState(min);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState<null | 'dodo' | 'credit'>(null);
  const [error, setError] = useState<string | null>(null);
  const [okCredit, setOkCredit] = useState(false);

  const belowMin = amount < min;
  const canUseCredit = credit >= amount && !belowMin;
  const quick = [min, min + 500, min + 1000, min + 2500];

  async function payWithDodo() {
    setError(null);
    setLoading('dodo');
    try {
      const { url } = await api<{ url: string }>('/checkout/dodo', {
        method: 'POST',
        body: JSON.stringify({ profileId, amountDop: amount }),
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
        body: JSON.stringify({ profileId, method: 'credit', amount, currency: 'DOP' }),
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
          <p className="font-bold">Pagaste {formatDOP(amount)} con tu saldo</p>
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

        <div className="glass space-y-1 p-3 text-[11px] text-white/55">
          {leaderTotalDop != null && (
            <div className="flex justify-between">
              <span>El #1 va en</span>
              <b className="text-white/80">{formatDOP(leaderTotalDop)}</b>
            </div>
          )}
          {myTotalDop != null && myTotalDop > 0 && (
            <div className="flex justify-between">
              <span>Tú llevas acumulado</span>
              <b className="text-white/80">{formatDOP(myTotalDop)}</b>
            </div>
          )}
          <div className="flex justify-between text-gold">
            <span>Oferta mínima ahora</span>
            <b>{formatDOP(min)}</b>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50">Tu oferta (RD$)</label>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="input mt-1"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quick.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`rounded-lg border px-2.5 py-1 text-xs ${
                  amount === v ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 text-white/60'
                }`}
              >
                {formatDOP(v)}
              </button>
            ))}
          </div>
          {belowMin && (
            <p className="mt-1 text-[11px] text-amber-300">
              Debes superar al #1: ofrece al menos {formatDOP(min)}.
            </p>
          )}
        </div>

        <div className="glass flex items-center justify-between p-3 text-sm">
          <span className="text-white/50">Total a pagar</span>
          <b className="text-lg text-gold">{formatDOP(amount)}</b>
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
          disabled={!accepted || belowMin || loading !== null}
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
