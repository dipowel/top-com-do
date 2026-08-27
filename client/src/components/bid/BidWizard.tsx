import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../common/Modal';
import BankTransferPanel from '../payments/BankTransferPanel';
import ReceiptUpload from '../payments/ReceiptUpload';
import PayPalButton from '../payments/PayPalButton';
import { formatDOP, formatUSD, dopToUsd, FX_USD_DOP } from '../../lib/format';
import { avatarFallback } from '../../lib/share';

interface Profile {
  id: string;
  name: string;
  handle: string;
  categoryName?: string;
  avatarUrl?: string | null;
}

const PRESETS = [500, 1000, 2500, 5000, 10000];

export default function BidWizard({
  presetProfileId,
  onClose,
}: {
  presetProfileId?: string;
  onClose: () => void;
}) {
  const { user, ready } = useAuth();
  const [step, setStep] = useState(presetProfileId ? 2 : 1);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState(presetProfileId ?? '');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<'bank_transfer' | 'paypal'>('bank_transfer');
  const [amountDop, setAmountDop] = useState(1000);
  const [bidId, setBidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<Profile[]>('/profiles')
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  const selected = profiles.find((p) => p.id === profileId);
  const usd = useMemo(() => dopToUsd(amountDop), [amountDop]);
  const filtered = useMemo(
    () =>
      profiles
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.handle.includes(query.toLowerCase()),
        )
        .slice(0, 24),
    [profiles, query],
  );

  async function createBid() {
    setError(null);
    setCreating(true);
    try {
      const payload =
        method === 'paypal'
          ? { profileId, method, amount: Number(usd.toFixed(2)), currency: 'USD' as const }
          : { profileId, method, amount: amountDop, currency: 'DOP' as const };
      const { bid } = await api<{ bid: { id: string } }>('/bids', {
        method: 'POST',
        body: JSON.stringify(payload),
        auth: true,
      });
      setBidId(bid.id);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (!ready) {
    return (
      <Modal onClose={onClose} title="Pujar Ahora">
        <p className="text-sm text-white/60">
          La autenticación no está configurada todavía. Agrega las claves <code>VITE_FIREBASE_*</code> en el
          entorno.
        </p>
      </Modal>
    );
  }

  if (!user) {
    return (
      <Modal onClose={onClose} title="Pujar Ahora">
        <p className="text-sm text-white/60">Necesitas iniciar sesión para pujar.</p>
        <Link to="/login" onClick={onClose} className="btn-gold mt-4 w-full">
          Iniciar sesión
        </Link>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={`Pujar Ahora · Paso ${Math.min(step, 3)}/3`}>
      {step === 1 && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Buscar perfil o marca…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProfileId(p.id);
                  setStep(2);
                }}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 p-2 text-left text-sm hover:bg-white/5"
              >
                <img src={p.avatarUrl || avatarFallback(p.name)} className="h-8 w-8 rounded-lg" alt="" />
                <span className="flex-1">
                  <span className="font-semibold">{p.name}</span>{' '}
                  <span className="text-white/40">@{p.handle}</span>
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="py-6 text-center text-xs text-white/40">
                No hay perfiles. Créalos desde “Perfil” o el panel admin.
              </p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="glass p-3 text-sm">
            Pujando por <b>{selected?.name ?? 'perfil seleccionado'}</b>
          </div>

          <div>
            <label className="text-xs text-white/50">Monto de la puja (DOP)</label>
            <input
              type="number"
              min={100}
              step={100}
              inputMode="numeric"
              className="input mt-1"
              value={amountDop}
              onChange={(e) => setAmountDop(Math.max(0, Number(e.target.value)))}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setAmountDop(v)}
                  className="btn-ghost !px-2.5 !py-1 text-xs"
                >
                  {v.toLocaleString('es-DO')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Método de pago</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod('bank_transfer')}
                className={`rounded-xl border p-3 text-left text-sm ${
                  method === 'bank_transfer' ? 'border-gold/50 bg-gold/10' : 'border-white/10'
                }`}
              >
                🏦 Transferencia
                <span className="mt-0.5 block text-[11px] text-white/40">
                  Banreservas · Popular · BHD · Qik
                </span>
              </button>
              <button
                onClick={() => setMethod('paypal')}
                className={`rounded-xl border p-3 text-left text-sm ${
                  method === 'paypal' ? 'border-gold/50 bg-gold/10' : 'border-white/10'
                }`}
              >
                🌎 PayPal (USD)
                <span className="mt-0.5 block text-[11px] text-white/40">
                  {formatUSD(usd)} · 1 USD = {FX_USD_DOP} DOP
                </span>
              </button>
            </div>
          </div>

          <div className="glass p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Total</span>
              <b>{formatDOP(amountDop)}</b>
            </div>
            {method === 'paypal' && (
              <div className="mt-0.5 flex justify-between text-xs text-white/40">
                <span>Se cobra en USD</span>
                <span>{formatUSD(usd)}</span>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn-ghost flex-1">
              Atrás
            </button>
            <button
              onClick={createBid}
              disabled={creating || amountDop < 100 || !profileId}
              className="btn-gold flex-1"
            >
              {creating ? 'Creando…' : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && bidId && (
        <div className="space-y-4">
          {method === 'bank_transfer' ? (
            <>
              <p className="text-sm text-white/70">
                Transfiere <b>{formatDOP(amountDop)}</b> a una de estas cuentas y sube tu comprobante. Un
                administrador lo verificará y tu puja aparecerá en el ranking.
              </p>
              <BankTransferPanel />
              <ReceiptUpload bidId={bidId} />
              <button onClick={onClose} className="btn-ghost w-full">
                Listo
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-white/70">
                Paga <b>{formatUSD(usd)}</b> con PayPal. Tu puja sube al ranking al instante.
              </p>
              <PayPalButton bidId={bidId} onVerified={() => setStep(4)} />
              <button onClick={onClose} className="btn-ghost w-full">
                Cerrar
              </button>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 py-4 text-center">
          <div className="text-4xl">🎉</div>
          <p className="font-bold">¡Pago confirmado!</p>
          <p className="text-sm text-white/60">Tu puja ya está reflejada en el ranking.</p>
          <button onClick={onClose} className="btn-gold w-full">
            Ver ranking
          </button>
        </div>
      )}
    </Modal>
  );
}
