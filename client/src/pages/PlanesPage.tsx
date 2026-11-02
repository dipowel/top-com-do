import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useSeo } from '../hooks/useSeo';
import { formatDOP } from '../lib/format';
import { fileToReceiptDataUrl } from '../lib/image';
import Spinner from '../components/common/Spinner';

interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string | null;
  instructions: string | null;
}

interface PricesResponse {
  prices: { verificado: number; destacado: number };
  bankAccounts: BankAccount[];
}

interface StatusResponse {
  plan: 'free' | 'verificado' | 'destacado';
  planExpiresAt: string | null;
  isVerified: boolean;
  featuredRemaining: number;
  lastPayment: {
    id: string;
    plan: 'verificado' | 'destacado';
    amountDop: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    rejectionReason: string | null;
  } | null;
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratis', verificado: 'Verificado', destacado: 'Destacado' };

export default function PlanesPage() {
  const { id = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [prices, setPrices] = useState<PricesResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<'verificado' | 'destacado' | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useSeo({
    title: 'Planes de tu negocio | Top.com.do',
    description: 'Elige el plan de tu negocio en Top.',
    canonical: `https://www.top.com.do/perfil/negocio/${id}/planes`,
    noindex: true,
  });

  async function load() {
    const [p, s] = await Promise.all([
      api<PricesResponse>('/plans/prices'),
      api<StatusResponse>(`/plans/${id}/status`, { auth: true }),
    ]);
    setPrices(p);
    setStatus(s);
    if (p.bankAccounts[0]) setBankAccountId(p.bankAccounts[0].id);
  }

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function onProofFile(file: File) {
    try {
      setProofDataUrl(await fileToReceiptDataUrl(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/plans/${id}/request`, {
        method: 'POST',
        body: JSON.stringify({ plan: picked, bankAccountId: bankAccountId || undefined, reference: reference || undefined, proofDataUrl: proofDataUrl || undefined }),
        auth: true,
      });
      setOk(true);
      setPicked(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!authLoading && !user) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/perfil/negocio/${id}/planes`)}`} replace />;
  }
  if (loading || !prices || !status) return <Spinner />;

  const pendingPayment = status.lastPayment?.status === 'pending' ? status.lastPayment : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-white">Planes de tu negocio</h1>
        <p className="text-sm text-white/55">
          Plan actual: <b className="text-gold">{PLAN_LABEL[status.plan]}</b>
          {status.planExpiresAt && ` · vence el ${new Date(status.planExpiresAt).toLocaleDateString('es-DO')}`}
          {status.isVerified && ' · ✅ Identidad verificada'}
        </p>
      </div>

      {pendingPayment && (
        <div className="glass border border-amber-400/30 p-3 text-xs text-amber-300">
          Tienes un pago de plan <b>{PLAN_LABEL[pendingPayment.plan]}</b> ({formatDOP(pendingPayment.amountDop)}) en
          revisión. Te avisamos en cuanto un administrador lo confirme.
        </div>
      )}
      {status.lastPayment?.status === 'rejected' && !pendingPayment && (
        <div className="glass border border-red-400/30 p-3 text-xs text-red-300">
          Tu último pago no pudo confirmarse{status.lastPayment.rejectionReason ? `: ${status.lastPayment.rejectionReason}` : '.'} Puedes
          intentarlo de nuevo abajo.
        </div>
      )}
      {ok && <p className="text-xs text-emerald-soft">✓ Pago enviado — queda pendiente de revisión.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="glass space-y-1.5 p-4">
          <div className="text-sm font-extrabold text-white">Verificado</div>
          <div className="text-2xl font-black text-gold">{formatDOP(prices.prices.verificado)}<span className="text-xs text-white/40">/mes</span></div>
          <p className="text-xs text-white/55">Insignia de identidad verificada, hasta 20 fotos + menú, estadísticas completas.</p>
          <button
            onClick={() => setPicked('verificado')}
            disabled={!!pendingPayment}
            className="btn-gold w-full !py-2 text-xs"
          >
            Elegir Verificado
          </button>
        </div>
        <div className="glass space-y-1.5 p-4">
          <div className="text-sm font-extrabold text-white">Destacado</div>
          <div className="text-2xl font-black text-gold">{formatDOP(prices.prices.destacado)}<span className="text-xs text-white/40">/mes</span></div>
          <p className="text-xs text-white/55">Todo lo de Verificado + un espacio "Destacado" en tu categoría y zona.</p>
          {status.featuredRemaining > 0 ? (
            <p className="text-[11px] text-emerald-soft">Quedan {status.featuredRemaining} espacio(s) en tu categoría/zona.</p>
          ) : (
            <p className="text-[11px] text-amber-300">Sin espacios libres ahora — tu pago queda en lista de espera.</p>
          )}
          <button
            onClick={() => setPicked('destacado')}
            disabled={!!pendingPayment}
            className="btn-gold w-full !py-2 text-xs"
          >
            Elegir Destacado
          </button>
        </div>
      </div>

      {picked && (
        <div className="glass space-y-3 p-4">
          <div className="text-sm font-bold text-gold">
            Pagar {PLAN_LABEL[picked]} · {formatDOP(picked === 'destacado' ? prices.prices.destacado : prices.prices.verificado)}
          </div>

          {prices.bankAccounts.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-white/50">Transfiere a:</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="input">
                {prices.bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} · {b.accountHolder} · {b.accountNumber}
                  </option>
                ))}
              </select>
              {prices.bankAccounts.find((b) => b.id === bankAccountId)?.instructions && (
                <p className="text-[11px] text-white/40">{prices.bankAccounts.find((b) => b.id === bankAccountId)?.instructions}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-white/50">Número de referencia de la transferencia</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="input mt-1" />
          </div>

          <div>
            <label className="text-xs text-white/50">Foto o PDF del comprobante</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => e.target.files?.[0] && onProofFile(e.target.files[0])}
              className="mt-1 block w-full text-xs text-white/60"
            />
            {proofDataUrl && <p className="mt-1 text-[11px] text-emerald-soft">✓ Comprobante listo para enviar</p>}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-gold flex-1 !py-2 text-xs">
              {busy ? 'Enviando…' : 'Enviar pago'}
            </button>
            <button onClick={() => setPicked(null)} className="btn-ghost flex-1 !py-2 text-xs">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Link to={`/perfil/negocio/${id}`} className="block text-center text-xs text-gold underline">
        ← Volver a mi panel
      </Link>
    </div>
  );
}
