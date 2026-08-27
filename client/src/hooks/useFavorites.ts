import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';

export interface FavoriteProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  whatsapp: string | null;
  city: string | null;
}

export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [list, setList] = useState<FavoriteProfile[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setIds(new Set());
      setList([]);
      return;
    }
    try {
      const rows = await api<FavoriteProfile[]>('/me/favorites', { auth: true });
      setList(rows);
      setIds(new Set(rows.map((r) => r.id)));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (profileId: string) => {
      if (!user) return;
      const has = ids.has(profileId);
      setIds((prev) => {
        const next = new Set(prev);
        if (has) next.delete(profileId);
        else next.add(profileId);
        return next;
      });
      try {
        await api(`/me/favorites/${profileId}`, { method: has ? 'DELETE' : 'POST', auth: true });
      } finally {
        void load();
      }
    },
    [ids, user, load],
  );

  return { ids, list, toggle, reload: load };
}
