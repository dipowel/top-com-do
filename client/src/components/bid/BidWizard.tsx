import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../common/Modal';
import BankTransferPanel from '../payments/BankTransferPanel';
import ReceiptUpload from '../payments/ReceiptUpload';
import ConfirmationNumber from '../payments/ConfirmationNumber';
import PayPalButton from '../payments/PayPalButton';
import ProfileForm, { emptyProfileForm, profileFormToPayload, type ProfileFormValue } from '../profile/ProfileForm';
import { formatDOP, formatUSD, dopToUsd, FX_USD_DOP } from '../../lib/format';
import { avatarFallback } from '../../lib/share';
import type { SuggestedBid } from '@shared/types';

interface Profile {
  id: string;
  name: string;
  handle: string;
  categoryName?: string;
  avatarUrl?: string | null;
}

type Mode = 'pick' | 'existing' | 'new';

export default function BidWizard({
  presetProfileId,
  presetCategory,
  presetProvince,
  onClose,
}: {
  presetProfileId?: string;
  presetCategory?: string;
  presetProvince?: string;
  onClose: () => void;
}) {
  const { user, me, ready, refreshMe } = useAuth();
  const [mode, setMode] = useState<Mode>(presetProfileId ? 'existing' : 'pick');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(presetProfileId ? 2 : 1);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState(presetProfileId ?? '');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<ProfileFormValue>({
    ...emptyProfileForm,
    categorySlug: presetCategory && presetCategory !== 'todo-rd' ? presetCategory : '',
    province: presetProvince && presetProvince !== 'todo-rd' ? presetProvince : '',
  });

  const [suggested, setSuggested] = useState<SuggestedBid | null>(null);
  const [amountDop, setAmountDop] = useState(200);
  const [method, setMethod] = useState<'bank_transfer' | 'paypal' | 'credit'>('bank_transfer');

  const credit = me?.creditBalanceDop ?? 0;
  const canUseCredit = credit >= amountDop && amountDop > 0;

  const [bidId, setBidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<Profile[]>('/profiles').then(setProfiles).catch(() => setProfiles([]));
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

  const loadSuggested = useCallback(
    async (pid?: string) => {
      try {
        const params = new URLSearchParams();
        if (pid) params.set('profileId', pid);
        else {
          if (presetCategory) params.set('category', presetCategory);
          if (presetProvince && presetProvince !== 'todo-rd') params.set('province', presetProvince);
        }
        const q = params.toString();
        const s = await api<SuggestedBid>(`/bids/suggested${q ? `?${q}` : ''}`);
        setSuggested(s);
        setAmountDop(s.next);
      } catch {
        setSuggested(null);
      }
    },
    [presetCategory, presetProvince],
  );

  // Paso 1 (existente): elegir perfil
  function chooseExisting(p: Profile) {
    setProfileId(p.id);
    setMode('existing');
    setStep(2);
    void loadSuggested(p.id);
  }

  // Paso 1 (nuevo): crear perfil y seguir
  async function createProfileThenBid() {
    setError(null);
    setCreating(true);
    try {
      if (form.tagline.length > 60) throw new Error('El mensaje corto no puede pasar de 60 caracteres');
      const created = await api<{ id: string }>('/profiles', {
        method: 'POST',
        body: JSON.stringify(profileFormToPayload(form)),
        auth: true,
      });
      setProfileId(created.id);
      setStep(2);
      await loadSuggested(created.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

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
      if (method === 'credit') {
        await refreshMe();
        setStep(4); // pago con saldo → puja ya verificada
      } else {
        setStep(3);
      }
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
          La autenticación no está configurada. Agrega las claves <code>VITE_FIREBASE_*</code>.
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

  const minAmount = suggested?.next ?? suggested?.minimum ?? 100;

  return (
    <Modal onClose={onClose} title={`Pujar Ahora · Paso ${Math.min(step, 3)}/3`}>
      {/* PASO 1 */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('existing')}
              className={`rounded-xl border p-3 text-sm ${mode === 'existing' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
            >
              📈 Perfil del ranking
            </button>
            <button
              onClick={() => setMode('new')}
              className={`rounded-xl border p-3 text-sm ${mode === 'new' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
            >
              ✨ Registrar nuevo
            </button>
          </div>

          {mode !== 'new' && (
            <>
              <input
                className="input"
                placeholder="Buscar perfil o marca…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => chooseExisting(p)}
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
                    Sin resultados. Usa “Registrar nuevo”.
                  </p>
                )}
              </div>
            </>
          )}

          {mode === 'new' && (
            <ProfileForm
              value={form}
              onChange={setForm}
              onSubmit={createProfileThenBid}
              submitLabel="Continuar al pago"
              busy={creating}
              error={error}
            />
          )}
        </div>
      )}

      {/* PASO 2 — monto + método */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="glass p-3 text-sm">
            Pujando por{' '}
            <b>{selected?.name || form.name || 'perfil seleccionado'}</b>
          </div>

          {suggested && (
            <div className="glass p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">
                  {suggested.scope === 'profile'
                    ? 'Acumulado de este perfil'
                    : suggested.scope === 'category'
                      ? 'Puja del #1 en la categoría'
                      : 'Puja del #1 general'}
                </span>
                <span className="font-semibold">{formatDOP(suggested.current)}</span>
              </div>
              <div className="mt-1 flex justify-between text-gold">
                <span>Para liderar / mantener el #1</span>
                <b>{formatDOP(suggested.next)}</b>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-white/50">Monto de la puja (RD$)</label>
            <input
              type="number"
              min={minAmount}
              step={100}
              inputMode="numeric"
              className="input mt-1"
              value={amountDop}
              onChange={(e) => setAmountDop(Math.max(0, Number(e.target.value)))}
            />
            <div className="mt-1 text-[11px] text-white/40">
              ≈ {formatUSD(usd)} &nbsp;·&nbsp; 1 USD = {FX_USD_DOP} RD$
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(() => {
                const base = suggested?.next ?? 200;
                return [base, base + 200, base + 500, base + 1000];
              })().map((v, i) => (
                <button key={i} onClick={() => setAmountDop(v)} className="btn-ghost !px-2.5 !py-1 text-xs">
                  {formatDOP(v)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Método de pago</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod('bank_transfer')}
                className={`rounded-xl border p-3 text-left text-sm ${method === 'bank_transfer' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
              >
                🏦 Transferencia
                <span className="mt-0.5 block text-[11px] text-white/40">Banreservas · BHD · Popular · Qik</span>
              </button>
              <button
                onClick={() => setMethod('paypal')}
                className={`rounded-xl border p-3 text-left text-sm ${method === 'paypal' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
              >
                🌎 PayPal
                <span className="mt-0.5 block text-[11px] text-white/40">Se cobra {formatUSD(usd)}</span>
              </button>
              {credit > 0 && (
                <button
                  onClick={() => canUseCredit && setMethod('credit')}
                  disabled={!canUseCredit}
                  className={`col-span-2 rounded-xl border p-3 text-left text-sm disabled:opacity-50 ${method === 'credit' ? 'border-gold/50 bg-gold/10' : 'border-white/10'}`}
                >
                  💳 Saldo por referidos
                  <span className="mt-0.5 block text-[11px] text-white/40">
                    Disponible: {formatDOP(credit)}
                    {!canUseCredit && amountDop > 0 ? ' · no cubre este monto' : ' · anúnciate gratis'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="glass p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Total en RD$</span>
              <b>{formatDOP(amountDop)}</b>
            </div>
            <div className="mt-0.5 flex justify-between text-xs text-white/40">
              <span>Equivalente en USD</span>
              <span>{formatUSD(usd)}</span>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setStep(1);
                setBidId(null);
              }}
              className="btn-ghost flex-1"
            >
              Atrás
            </button>
            <button
              onClick={createBid}
              disabled={
                creating ||
                amountDop < (suggested?.minimum ?? 100) ||
                !profileId ||
                (method === 'credit' && !canUseCredit)
              }
              className="btn-gold flex-1"
            >
              {creating ? 'Creando…' : method === 'credit' ? 'Pagar con saldo' : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3 — pago */}
      {step === 3 && bidId && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald/30 bg-emerald/10 p-3">
            <div className="text-sm font-bold text-emerald-soft">
              ✅ Puja creada · {formatDOP(amountDop)}
            </div>
            <div className="mt-0.5 text-xs text-white/60">
              Estado: <b>En revisión</b>. Puedes seguir su estado en “Mis Pujas”.
            </div>
          </div>

          {method === 'bank_transfer' ? (
            <>
              <p className="text-sm text-white/70">
                Transfiere <b>{formatDOP(amountDop)}</b> a una de estas cuentas. Luego sube el
                comprobante <b>o</b> pega el número de confirmación. Un administrador lo verifica y tu
                perfil sube al ranking.
              </p>
              <BankTransferPanel />
              <ConfirmationNumber bidId={bidId} />
              <ReceiptUpload bidId={bidId} />
              <button onClick={onClose} className="btn-gold w-full">
                Listo, ya transferí
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-white/70">
                Paga <b>{formatUSD(usd)}</b> ({formatDOP(amountDop)}) con PayPal. Tu puja sube al
                ranking al instante.
              </p>
              <PayPalButton bidId={bidId} onVerified={() => setStep(4)} />
              <button onClick={onClose} className="btn-ghost w-full">
                Cerrar
              </button>
            </>
          )}
        </div>
      )}

      {/* PASO 4 — éxito PayPal */}
      {step === 4 && (
        <div className="space-y-3 py-4 text-center">
          <div className="text-4xl">🎉</div>
          <p className="font-bold">¡Pago confirmado!</p>
          <p className="text-sm text-white/60">Tu puja ya está en el ranking.</p>
          <button onClick={onClose} className="btn-gold w-full">
            Ver ranking
          </button>
        </div>
      )}
    </Modal>
  );
}
