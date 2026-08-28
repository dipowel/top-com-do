import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { useShell } from '../hooks/useShell';
import Spinner from '../components/common/Spinner';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { items, unread, loading, markAllRead } = useNotifications();
  const { openBid } = useShell();
  const nav = useNavigate();

  // Marca todo como leído al abrir la página
  useEffect(() => {
    if (unread > 0) {
      const t = window.setTimeout(() => void markAllRead(), 1000);
      return () => window.clearTimeout(t);
    }
  }, [unread, markAllRead]);

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-extrabold">Notificaciones</h1>
        <Link to="/login" className="btn-gold w-full">
          Inicia sesión para ver tus notificaciones
        </Link>
      </div>
    );
  }
  if (loading && !items.length) return <Spinner />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">Notificaciones</h1>
      {!items.length && <p className="text-sm text-white/50">No tienes notificaciones todavía.</p>}

      {items.map((n) => {
        const meta = (n.meta ?? {}) as Record<string, string>;
        const isDethroned = n.type === 'rank.dethroned' && meta.profileId;
        return (
          <div key={n.id} className={`glass p-3 ${n.readAt ? '' : 'border border-gold/30'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold">{n.title}</div>
                <div className="mt-0.5 text-xs text-white/60">{n.body}</div>
                <div className="mt-1 text-[10px] text-white/35">
                  {new Date(n.createdAt).toLocaleString('es-DO')}
                </div>
              </div>
              {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />}
            </div>

            {isDethroned ? (
              <button
                onClick={() => openBid(meta.profileId, meta.categorySlug, meta.province)}
                className="btn-gold mt-2 w-full !py-2 text-xs"
              >
                👑 Volver a ser #1
              </button>
            ) : n.url ? (
              <button
                onClick={() => nav(n.url!)}
                className="btn-ghost mt-2 w-full !py-2 text-xs"
              >
                Ver
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
