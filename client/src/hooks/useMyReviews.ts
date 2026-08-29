import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';
import type { MyReviewDTO } from '@shared/types';

export function useMyReviews() {
  const { user } = useAuth();
  const [data, setData] = useState<MyReviewDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setData(await api<MyReviewDTO[]>('/me/reviews', { auth: true }));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, reload: load };
}
