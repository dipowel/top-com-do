import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMyBids } from '../hooks/useMyBids';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import Spinner from '../components/common/Spinner';
import { formatDOP } from '../lib/format';

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-400/15 text-amber-300' },
  verified: { label: 'Verificada', cls: 'bg-emerald/15 text-emerald-soft' },
  rejected: { label: 'Rechazada', cls: 'bg-red-400/15 text-red-300' },
};

const METHOD: Record<string, string> = {
  dodo: 'Dodo Payments',
  credit: 'Saldo',
  bank_transfer: 'Transferencia',
  paypal: 'PayPal',
};

export default function MyBidsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useMyBids();
  const [params, setParams] = useSearchParams();
  const procesando = params.get('pago') === 'procesando';
  const [checking, setChecking] = useState(false);

  // Pregunta a Dodo por los pagos del usuario y acredita lo que ya esté pagado.
  async function checkPayments() {
    setChecking(true);
    try {
      await api('/checkout/dodo/status', { auth: true });
    } catch {
      /* ignore */
    } finally {
      await reload();
      setChecking(false);
    }
  }

  // Tras volver del checkout de Dodo: reconciliar una vez y luego refrescar unos segundos.
  useEffect(() => {
    if (!procesando) return;
    void checkPayments();
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      void reload();
      if (n >= 6) {
        window.clearInterval(id);
        const next = new URLSearchParams(params);
        next.delete('pago');
        setParams(next, { replace: true });
      }
    }, 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesando]);

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-extrabold">Mis pujas</h1>
        <Link to="/login" className="btn-gold w-full">
          Inicia sesión para ver tus pujas
        </Link>
      </div>
    );
  }
  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">Mis pujas</h1>

      {procesando && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold">
          Estamos confirmando tu pago con Dodo Payments… Esta página se actualiza sola.
        </div>
      )}

      {!data.length && <p className="text-sm text-white/50">Todavía no has pujado.</p>}
      {data.map((b) => (
        <div key={b.id} className="glass p-3">
          <div className="flex items-center justify-between">
            <Link to={`/p/${b.profileId}`} className="font-semibold">
              {b.profileName}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[b.status]?.cls}`}>
              {STATUS[b.status]?.label ?? b.status}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-white/50">
            <span>
              {METHOD[b.method] ?? b.method} · {new Date(b.createdAt).toLocaleDateString('es-DO')}
            </span>
            <span className="font-bold text-white">{formatDOP(b.amountDop)}</span>
          </div>
          {b.status === 'pending' && b.method === 'dodo' && (
            <div className="mt-2 space-y-1.5 rounded-lg bg-white/5 p-2">
              <p className="text-[11px] text-white/50">
                Esperando la confirmación del pago.
              </p>
              <button
                onClick={checkPayments}
                disabled={checking}
                className="btn-ghost !py-1 text-[11px]"
              >
                {checking ? 'Revisando…' : 'Ya pagué — revisar ahora'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
