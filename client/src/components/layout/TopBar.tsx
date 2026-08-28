import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function TopBar() {
  const { user, me, isAdmin } = useAuth();

  const shortName =
    user?.displayName?.split(' ')[0] ||
    me?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0];

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-base/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Top<span className="text-gold">.com.do</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link to="/admin" className="btn-ghost !px-3 !py-1.5 text-xs">
              Admin
            </Link>
          )}
          <Link to="/perfil" className="btn-ghost !px-3 !py-1.5 text-xs">
            {user ? shortName || 'Mi perfil' : 'Entrar'}
          </Link>
        </div>
      </div>
    </header>
  );
}
