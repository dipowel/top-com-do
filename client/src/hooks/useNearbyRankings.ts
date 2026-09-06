import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Coords } from '../lib/geo';
import type { NearbyRankingEntry } from '@shared/types';

/**
 * Ranking "Cerca de mí": una sola consulta por combinación (coords × categoría ×
 * provincia). Sin polling — el resultado es personalizado y no cambia segundo a
 * segundo. `coords = null` (modo global) deja el hook inactivo.
 */
export function useNearbyRankings(
  coords: Coords | null,
  categorySlug: string,
  provinceSlug = 'todo-rd',
) {
  const [data, setData] = useState<NearbyRankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(coords.latitude),
        lon: String(coords.longitude),
      });
      if (categorySlug && categorySlug !== 'todo-rd') params.set('category', categorySlug);
      if (provinceSlug && provinceSlug !== 'todo-rd') params.set('province', provinceSlug);
      setData(await api<NearbyRankingEntry[]>(`/rankings/nearby?${params}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [coords, categorySlug, provinceSlug]);

  useEffect(() => {
    if (!coords) {
      setData([]);
      setError(null);
      return;
    }
    void load();
  }, [coords, load]);

  return { data, loading, error, reload: load };
}
