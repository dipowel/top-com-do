import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationBell({ to = '/notificaciones' }: { to?: string }) {
  const { user } = useAuth();
  const { unread } = useNotifications();
  if (!user) return null;

  return (
    <Link
      to={to}
      aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-base hover:bg-white/5"
    >
      🔔
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-black leading-none text-black">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
