import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';
import type { NotificationDTO } from '@shared/types';

/** Notificaciones del usuario, con sondeo periódico (in-app, sin push). */
export function useNotifications(intervalMs = 25000) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setItems(await api<NotificationDTO[]>('/me/notifications', { auth: true }));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const id = window.setInterval(load, intervalMs);
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, user, intervalMs]);

  const unread = items.filter((n) => !n.readAt).length;

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    try {
      await api('/me/notifications/read', { method: 'POST', body: JSON.stringify({}), auth: true });
    } catch {
      /* ignore */
    }
  }, []);

  return { items, unread, loading, reload: load, markAllRead };
}
