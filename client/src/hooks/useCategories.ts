import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CategoryDTO } from '@shared/types';

export function useCategories(): CategoryDTO[] {
  const [data, setData] = useState<CategoryDTO[]>([]);
  useEffect(() => {
    api<CategoryDTO[]>('/categories')
      .then(setData)
      .catch(() => setData([]));
  }, []);
  return data;
}
