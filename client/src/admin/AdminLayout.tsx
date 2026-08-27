import { NavLink, Route, Routes, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';
import AdminOverview from './AdminOverview';
import ReceiptsQueue from './ReceiptsQueue';
import BidsAudit from './BidsAudit';
import BankAccountsEditor from './BankAccountsEditor';
import RoundsControl from './RoundsControl';
import AuditLog from './AuditLog';

const tabs = [
  { to: '', label: 'Resumen', end: true },
  { to: 'comprobantes', label: 'Comprobantes' },
  { to: 'pujas', label: 'Auditoría de pujas' },
  { to: 'cuentas', label: 'Cuentas bancarias' },
  { to: 'rondas', label: 'Rondas' },
  { to: 'log', label: 'Log' },
];

export default function AdminLayout() {
  const { loading, me, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!user || !me || (me.role !== 'admin' && me.role !== 'superadmin')) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-white/60">Acceso restringido al superadministrador.</p>
        <Link to="/" className="btn-gold mt-4">
          Volver al sitio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold">
          Panel · Top<span className="text-gold">.com.do</span>
        </h1>
        <Link to="/" className="btn-ghost !py-1.5 text-xs">
          Ver sitio
        </Link>
      </div>

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={`/admin/${t.to}`}
            end={t.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                isActive ? 'border-gold/50 bg-gold/10 text-gold' : 'border-white/10 text-white/55'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="comprobantes" element={<ReceiptsQueue />} />
        <Route path="pujas" element={<BidsAudit />} />
        <Route path="cuentas" element={<BankAccountsEditor />} />
        <Route path="rondas" element={<RoundsControl />} />
        <Route path="log" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  );
}
