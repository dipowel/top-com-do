import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Row {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actorEmail: string | null;
}

export default function AuditLog() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api<Row[]>('/admin/audit-log', { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="glass overflow-x-auto p-1">
      <table className="w-full text-left text-xs">
        <thead className="text-white/40">
          <tr>
            <th className="p-2">Fecha</th>
            <th className="p-2">Actor</th>
            <th className="p-2">Acción</th>
            <th className="p-2">Entidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/5">
              <td className="p-2">{new Date(r.createdAt).toLocaleString('es-DO')}</td>
              <td className="p-2">{r.actorEmail || 'sistema'}</td>
              <td className="p-2">{r.action}</td>
              <td className="p-2">{r.entity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
