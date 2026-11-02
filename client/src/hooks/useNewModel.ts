import { useEffect, useState } from 'react';
import { api } from '../lib/api';

let cached: Promise<boolean> | null = null;
function fetchNewModel(): Promise<boolean> {
  if (!cached) {
    cached = api<{ newModel: boolean }>('/rankings/model')
      .then((r) => r.newModel)
      .catch(() => false);
  }
  return cached;
}

/**
 * ¿Está activo el ranking v2 (orgánico, por reseñas)? Mientras no lo esté (el estado de hoy),
 * la interfaz se ve exactamente igual que siempre. Un solo fetch compartido por toda la sesión
 * del navegador — el flag es de servidor y no cambia mientras la pestaña esté abierta.
 */
export function useNewModel(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchNewModel().then((v) => {
      if (alive) setOn(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
