import { NavLink, Route, Routes, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';
import AdminOverview from './AdminOverview';
import ReceiptsQueue from './ReceiptsQueue';
import BidsAudit from './BidsAudit';
import BankAccountsEditor from './BankAccountsEditor';
import RoundsControl from './RoundsControl';
import AuditLog from './AuditLog';
import ReferralsQueue from './ReferralsQueue';
import NotificationBell from '../components/layout/NotificationBell';

const tabs = [
  { to: '', label: 'Resumen', end: true },
  { to: 'comprobantes', label: 'Pagos por revisar' },
  { to: 'referidos', label: 'Referidos' },
  { to: 'pujas', label: 'Auditoría de pujas' },
  { to: 'cuentas', label: 'Cuentas bancarias' },
  { to: 'rondas', label: 'Rondas' },
  { to: 'log', label: 'Log' },
];

export default function AdminLayout() {
  const { loading, user, isAdmin, meError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!user || !isAdmin) {
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Top.com.do" className="h-7 w-auto" />
          <span className="text-sm font-semibold text-white/50">· Panel</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <Link to="/" className="btn-ghost !py-1.5 text-xs">
            Ver sitio
          </Link>
        </div>
      </div>

      {meError && (
        <div className="glass mb-4 p-3 text-xs text-amber-300">
          El servidor no confirmó tu sesión: <b>{meError}</b>. Revisa{' '}
          <code>FIREBASE_SERVICE_ACCOUNT_BASE64</code> y <code>SUPERADMIN_EMAILS</code> en Vercel.
          Las acciones de administración fallarán hasta resolverlo.
        </div>
      )}

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
        <Route path="referidos" element={<ReferralsQueue />} />
        <Route path="pujas" element={<BidsAudit />} />
        <Route path="cuentas" element={<BankAccountsEditor />} />
        <Route path="rondas" element={<RoundsControl />} />
        <Route path="log" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </div>
  );
}
