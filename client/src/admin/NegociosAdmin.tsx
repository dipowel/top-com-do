import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';
import EditProfileAdminModal, { type AdminProfileRow } from './EditProfileAdminModal';

const FILTERS: Array<{ v: string; label: string }> = [
  { v: 'all', label: 'Todos' },
  { v: 'active', label: 'Activos' },
  { v: 'inactive', label: 'Inactivos' },
  { v: 'free', label: 'Gratis' },
  { v: 'paid', label: 'De pago' },
];

export default function NegociosAdmin() {
  const [rows, setRows] = useState<AdminProfileRow[]>([]);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminProfileRow | null>(null);

  // Debounce del buscador (350 ms).
  useEffect(() => {
    const id = window.setTimeout(() => setDq(q.trim()), 350);
    return () => window.clearTimeout(id);
  }, [q]);

  const load = useCallback(() => {
    const params = new URLSearchParams({ status });
    if (dq) params.set('q', dq);
    api<AdminProfileRow[]>(`/admin/profiles?${params}`, { auth: true })
      .then(setRows)
      .catch((e) => {
        setRows([]);
        setMsg((e as Error).message);
      });
  }, [status, dq]);

  useEffect(() => {
    load();
  }, [load]);

  async function deactivate(row: AdminProfileRow) {
    if (!window.confirm(`¿Quitar "${row.name}" del directorio? Podrás reactivarlo después.`)) return;
    setBusy(row.id);
    try {
      await api(`/admin/profiles/${row.id}`, { method: 'DELETE', auth: true });
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reactivate(row: AdminProfileRow) {
    setBusy(row.id);
    try {
      await api(`/admin/profiles/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
        auth: true,
      });
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setStatus(f.v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === f.v ? 'border-gold/50 text-gold' : 'border-white/10 text-white/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o slug…"
        aria-label="Buscar negocio"
        className="input mb-3"
      />

      {msg && <p className="mb-2 text-xs text-white/60">{msg}</p>}

      <div className="glass overflow-x-auto p-1">
        <table className="w-full text-left text-xs">
          <thead className="text-white/40">
            <tr>
              <th className="p-2">Negocio</th>
              <th className="p-2">Categoría / Provincia</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Creado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="p-2">
                  <Link to={`/p/${b.id}`} className="font-semibold text-white/85 hover:text-gold">
                    {b.name}
                  </Link>
                  <div className="text-[10px] text-white/35">@{b.handle}</div>
                </td>
                <td className="p-2">
                  {b.categoryName}
                  <div className="text-[10px] text-white/35">
                    {b.provinceName ?? b.city ?? '—'}
                  </div>
                </td>
                <td className="p-2">
                  {b.isPaid ? (
                    <span className="text-gold">De pago · {formatDOP(b.activeBidTotal)}</span>
                  ) : (
                    <span className="text-white/40">Gratis</span>
                  )}
                </td>
                <td className="p-2">
                  {b.isActive ? (
                    <span className="text-emerald-soft">Activo</span>
                  ) : (
                    <span className="text-red-300">Inactivo</span>
                  )}
                </td>
                <td className="p-2">{new Date(b.createdAt).toLocaleDateString('es-DO')}</td>
                <td className="p-2">
                  <span className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setEditing(b)}
                      className="rounded border border-gold/40 px-2 py-0.5 text-[10px] text-gold"
                    >
                      ✎ Editar
                    </button>
                    {b.isActive ? (
                      <button
                        onClick={() => deactivate(b)}
                        disabled={busy === b.id}
                        className="rounded border border-red-400/40 px-2 py-0.5 text-[10px] text-red-300"
                      >
                        🚫 Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivate(b)}
                        disabled={busy === b.id}
                        className="rounded border border-emerald/40 px-2 py-0.5 text-[10px] text-emerald-soft"
                      >
                        ✅ Reactivar
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && <p className="mt-3 text-sm text-white/50">Sin negocios que mostrar.</p>}

      {editing && (
        <EditProfileAdminModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
