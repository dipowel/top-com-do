import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { RankingEntry } from '@shared/types';

/**
 * Ranking en vivo: consulta la API (no-store) al montar, cada `intervalMs`,
 * y cuando la pestaña vuelve a estar visible. Nada se guarda en localStorage.
 */
export function useRankings(categorySlug: string, intervalMs = 15000) {
  const [data, setData] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
      setData(await api<RankingEntry[]>(`/rankings${q}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [categorySlug]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = window.setInterval(load, intervalMs);
    const onFocus = () => void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, intervalMs]);

  return { data, loading, error, reload: load };
}
