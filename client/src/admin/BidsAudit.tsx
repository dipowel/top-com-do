import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDOP } from '../lib/format';

interface Row {
  id: string;
  amountDop: number;
  method: string;
  status: string;
  createdAt: string;
  profileName: string;
  bidderEmail: string;
}

const FILTERS = ['', 'pending', 'verified', 'rejected'];

export default function BidsAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api<Row[]>(`/admin/bids${status ? `?status=${status}` : ''}`, { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, [status]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === s ? 'border-gold/50 text-gold' : 'border-white/10 text-white/50'
            }`}
          >
            {s || 'Todas'}
          </button>
        ))}
      </div>
      <div className="glass overflow-x-auto p-1">
        <table className="w-full text-left text-xs">
          <thead className="text-white/40">
            <tr>
              <th className="p-2">Fecha</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Usuario</th>
              <th className="p-2">Método</th>
              <th className="p-2">Monto</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="p-2">{new Date(b.createdAt).toLocaleDateString('es-DO')}</td>
                <td className="p-2">{b.profileName}</td>
                <td className="p-2">{b.bidderEmail}</td>
                <td className="p-2">{b.method}</td>
                <td className="p-2 font-bold">{formatDOP(b.amountDop)}</td>
                <td className="p-2">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
