import { useState } from 'react';
import Modal from '../components/common/Modal';
import { api } from '../lib/api';
import { REAL_CATEGORY_DEFS } from '@shared/categories';
import { PROVINCE_DEFS } from '@shared/provinces';

export interface AdminProfileRow {
  id: string;
  name: string;
  handle: string;
  tagline: string | null;
  bio: string | null;
  categorySlug: string;
  categoryName: string;
  province: string | null;
  provinceName: string | null;
  city: string | null;
  whatsapp: string | null;
  instagramUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
  ownerEmail: string | null;
  activeBidTotal: number;
  isPaid: boolean;
}

export default function EditProfileAdminModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: AdminProfileRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [categorySlug, setCategorySlug] = useState(profile.categorySlug);
  const [province, setProvince] = useState(profile.province ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? '');
  const [instagramUrl, setInstagramUrl] = useState(profile.instagramUrl ?? '');
  const [latitude, setLatitude] = useState(profile.latitude != null ? String(profile.latitude) : '');
  const [longitude, setLongitude] = useState(
    profile.longitude != null ? String(profile.longitude) : '',
  );
  const [isActive, setIsActive] = useState(profile.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function coord(raw: string, min: number, max: number): number | null | undefined {
    const s = raw.trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < min || n > max) return undefined; // inválido
    return n;
  }

  async function save() {
    setError(null);
    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    const lat = coord(latitude, -90, 90);
    const lon = coord(longitude, -180, 180);
    if (lat === undefined || lon === undefined) {
      setError('Latitud/longitud fuera de rango');
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/profiles/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim(),
          bio: bio.trim(),
          categorySlug,
          province,
          city: city.trim(),
          whatsapp: whatsapp.trim(),
          instagramUrl: instagramUrl.trim(),
          latitude: lat,
          longitude: lon,
          isActive,
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
    <Modal title={`Editar · ${profile.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/50">Nombre del negocio</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-white/50">Frase corta</label>
          <input
            className="input mt-1"
            maxLength={60}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-white/50">Descripción</label>
          <textarea
            className="input mt-1"
            rows={3}
            maxLength={400}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50">Categoría</label>
            <select
              className="input mt-1"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
            >
              {REAL_CATEGORY_DEFS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50">Provincia</label>
            <select
              className="input mt-1"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">Sin provincia</option>
              {PROVINCE_DEFS.filter((p) => p.slug !== 'todo-rd').map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50">Ciudad / municipio</label>
          <input className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50">WhatsApp</label>
            <input
              className="input mt-1"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Instagram</label>
            <input
              className="input mt-1"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50">Latitud</label>
            <input
              type="number"
              step="any"
              className="input mt-1"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Longitud</label>
            <input
              type="number"
              step="any"
              className="input mt-1"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50">Estado</label>
          <select
            className="input mt-1"
            value={isActive ? 'active' : 'inactive'}
            onChange={(e) => setIsActive(e.target.value === 'active')}
          >
            <option value="active">Activo (visible en el directorio)</option>
            <option value="inactive">Inactivo (oculto)</option>
          </select>
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
