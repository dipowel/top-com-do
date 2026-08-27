import { auth } from './firebase';

const BASE = import.meta.env.VITE_API_BASE || '/api';

async function authHeader(): Promise<Record<string, string>> {
  const u = auth?.currentUser;
  if (!u) return {};
  const token = await u.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

interface Options extends RequestInit {
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.auth) Object.assign(headers, await authHeader());

  const res = await fetch(`${BASE}${path}`, { ...opts, headers, cache: 'no-store' });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `Error ${res.status}`);
  }
  return data as T;
}
