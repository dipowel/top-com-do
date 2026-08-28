import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';

export interface MyBid {
  id: string;
  amountDop: number;
  currency: 'DOP' | 'USD';
  amountOriginal: number;
  method: 'bank_transfer' | 'paypal' | 'credit';
  status: 'pending' | 'verified' | 'rejected';
  reference: string | null;
  createdAt: string;
  verifiedAt: string | null;
  profileId: string;
  profileName: string;
  profileHandle: string;
  profileAvatar: string | null;
  receiptUrl: string | null;
}

export function useMyBids() {
  const { user } = useAuth();
  const [data, setData] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setData(await api<MyBid[]>('/me/bids', { auth: true }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, reload: load };
}
