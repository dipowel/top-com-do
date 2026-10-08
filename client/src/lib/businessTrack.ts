import { api } from './api';
import type { BusinessEventType } from '@shared/types';

/**
 * Evento del dashboard de métricas del negocio (vistas, clics de contacto). Nunca bloquea al
 * visitante: si falla, no hace nada. Evita duplicados dentro de la misma pestaña (p. ej. nunca
 * manda `business_view` dos veces para el mismo negocio en la misma sesión de navegación).
 */
const SESSION_KEY = 'topSessionId';
const sentThisTab = new Set<string>();

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-session-storage';
  }
}

export function trackBusinessEvent(profileId: string, eventType: BusinessEventType, dedupe = true): void {
  const key = `${profileId}:${eventType}`;
  if (dedupe && sentThisTab.has(key)) return;
  sentThisTab.add(key);

  void api(`/profiles/${profileId}/events`, {
    method: 'POST',
    body: JSON.stringify({ eventType, sessionId: getSessionId() }),
  }).catch(() => {
    /* no-op: nunca debe afectar la navegación real del visitante */
  });
}
