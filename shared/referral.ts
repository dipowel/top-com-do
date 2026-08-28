/** Normaliza un código de referido: mayúsculas, sin espacios, 3–20 alfanuméricos. */
export function normalizeRefCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z0-9]{3,20}$/.test(c) ? c : null;
}

/** Extrae el código `?ref=` limpio de un query string (o null si no es válido). */
export function extractRefCode(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    return normalizeRefCode(params.get('ref'));
  } catch {
    return null;
  }
}
