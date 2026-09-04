import { useState } from 'react';
import Modal from '../components/common/Modal';
import { api } from '../lib/api';
import { PROVINCE_DEFS } from '@shared/provinces';

export interface EditableBid {
  id: string;
  amountDop: number;
  status: string;
  profileName: string;
  province: string | null;
  city: string | null;
  address: string | null;
  bidderEmail: string;
}

/** Corrección manual rápida: nombre del negocio, monto, estado, correo y ubicación. */
export default function EditBidModal({
  bid,
  onClose,
  onSaved,
}: {
  bid: EditableBid;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [profileName, setProfileName] = useState(bid.profileName);
  const [amountDop, setAmountDop] = useState(String(bid.amountDop));
  const [status, setStatus] = useState(bid.status);
  const [userEmail, setUserEmail] = useState(bid.bidderEmail);
  const [province, setProvince] = useState(bid.province ?? '');
  const [city, setCity] = useState(bid.city ?? '');
  const [address, setAddress] = useState(bid.address ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const amount = Number(amountDop);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El monto debe ser un número mayor a 0');
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/bids/${bid.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          profileName: profileName.trim(),
          amountDop: amount,
          status,
          userEmail: userEmail.trim(),
          province,
          city: city.trim(),
          address: address.trim(),
        }),
        auth: true,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Editar · ${bid.profileName}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50">Nombre del negocio</label>
          <input
            className="input mt-1"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50">Monto de la puja (RD$)</label>
            <input
              type="number"
              min={1}
              step="0.01"
              className="input mt-1"
              value={amountDop}
              onChange={(e) => setAmountDop(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Estado</label>
            <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">pending</option>
              <option value="verified">verified</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50">Correo del usuario</label>
          <input
            type="email"
            className="input mt-1"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-white/50">Provincia</label>
          <select className="input mt-1" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Sin provincia</option>
            {PROVINCE_DEFS.filter((p) => p.slug !== 'todo-rd').map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50">Ciudad</label>
            <input className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-white/50">Dirección</label>
            <input className="input mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-gold flex-1">
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
