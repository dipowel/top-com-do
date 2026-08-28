import { Link } from 'react-router-dom';
import { useMyBids } from '../hooks/useMyBids';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';
import { formatDOP, formatUSD } from '../lib/format';

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-400/15 text-amber-300' },
  verified: { label: 'Verificada', cls: 'bg-emerald/15 text-emerald-soft' },
  rejected: { label: 'Rechazada', cls: 'bg-red-400/15 text-red-300' },
};

export default function MyBidsPage() {
  const { user } = useAuth();
  const { data, loading } = useMyBids();

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
              {b.method === 'paypal' ? 'PayPal' : 'Transferencia'} ·{' '}
              {new Date(b.createdAt).toLocaleDateString('es-DO')}
            </span>
            <span className="font-bold text-white">
              {b.currency === 'USD' ? formatUSD(b.amountOriginal) : formatDOP(b.amountDop)}
            </span>
          </div>
          {b.status === 'pending' && b.method === 'bank_transfer' && !b.receiptUrl && !b.reference && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              Falta el comprobante o el número de confirmación para verificarla.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
