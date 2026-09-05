import { lazy, Suspense, useRef, useState, type FormEvent } from 'react';
import { useCategories } from '../../hooks/useCategories';
import { fileToLogoDataUrl } from '../../lib/image';
import { avatarFallback } from '../../lib/share';
import { getCurrentPosition } from '../../lib/geo';
import { subcategoriesFor } from '@shared/categories';
import { PROVINCE_DEFS } from '@shared/provinces';

// Leaflet pesa ~150 KB+: se carga solo cuando este formulario se abre (nunca en
// las páginas de tráfico alto como el ranking/explorar).
const LocationPicker = lazy(() => import('./LocationPicker'));

export interface ProfileFormValue {
  name: string;
  categorySlug: string;
  subcategory: string;
  tagline: string;
  whatsapp: string;
  instagramUrl: string;
  websiteUrl: string;
  province: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  avatarUrl: string;
}

export const emptyProfileForm: ProfileFormValue = {
  name: '',
  categorySlug: '',
  subcategory: '',
  tagline: '',
  whatsapp: '',
  instagramUrl: '',
  websiteUrl: '',
  province: '',
  city: '',
  address: '',
  latitude: null,
  longitude: null,
  avatarUrl: '',
};

const TAGLINE_MAX = 60;

export default function ProfileForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy,
  error,
}: {
  value: ProfileFormValue;
  onChange: (v: ProfileFormValue) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
}) {
  const cats = useCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const set = (patch: Partial<ProfileFormValue>) => onChange({ ...value, ...patch });

  const subs = subcategoriesFor(value.categorySlug);

  async function pickLogo(file: File) {
    setImgBusy(true);
    try {
      set({ avatarUrl: await fileToLogoDataUrl(file) });
    } catch {
      /* ignore */
    } finally {
      setImgBusy(false);
    }
  }

  async function captureGps() {
    setGpsBusy(true);
    setGpsError(null);
    try {
      const c = await getCurrentPosition();
      set({ latitude: c.latitude, longitude: c.longitude });
    } catch (e) {
      setGpsError((e as Error).message);
    } finally {
      setGpsBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Logo / foto */}
      <div className="flex items-center gap-3">
        <img
          src={value.avatarUrl || avatarFallback(value.name || 'Nuevo')}
          width={64}
          height={64}
          decoding="async"
          className="h-16 w-16 rounded-xl object-cover"
          alt=""
        />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickLogo(f);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost !py-1.5 text-xs">
            {imgBusy ? 'Procesando…' : value.avatarUrl ? 'Cambiar logo' : '📷 Subir logo / foto'}
          </button>
          <p className="mt-1 text-[11px] text-white/40">Se comprime en tu teléfono.</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50">Nombre / Marca / Pica Pollo / Político</label>
        <input
          required
          className="input mt-1"
          placeholder="Ej. Dipowel Rent Car"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-white/50">Categoría</label>
          <select
            required
            className="input mt-1"
            value={value.categorySlug}
            onChange={(e) => set({ categorySlug: e.target.value, subcategory: '' })}
          >
            <option value="">Selecciona…</option>
            {cats
              .filter((c) => c.slug !== 'todo-rd')
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50">Rubro específico</label>
          <select
            className="input mt-1"
            value={value.subcategory}
            disabled={!subs.length}
            onChange={(e) => set({ subcategory: e.target.value })}
          >
            <option value="">{subs.length ? 'Selecciona…' : '—'}</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-center justify-between text-xs text-white/50">
          <span>Mensaje corto destacable</span>
          <span className={value.tagline.length > TAGLINE_MAX ? 'text-red-400' : 'text-white/30'}>
            {value.tagline.length}/{TAGLINE_MAX}
          </span>
        </label>
        <input
          className="input mt-1"
          maxLength={TAGLINE_MAX}
          placeholder="Ej. La mejor Rent Car de República Dominicana"
          value={value.tagline}
          onChange={(e) => set({ tagline: e.target.value.slice(0, TAGLINE_MAX) })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-white/50">Instagram</label>
          <input
            className="input mt-1"
            placeholder="@tumarca  o  instagram.com/tumarca"
            value={value.instagramUrl}
            onChange={(e) => set({ instagramUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-white/50">WhatsApp Business</label>
          <input
            className="input mt-1"
            placeholder="18091234567"
            value={value.whatsapp}
            onChange={(e) => set({ whatsapp: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-white/50">Web</label>
          <input
            className="input mt-1"
            placeholder="https://…"
            value={value.websiteUrl}
            onChange={(e) => set({ websiteUrl: e.target.value })}
          />
        </div>
      </div>

      {/* Ubicación */}
      <div className="glass p-3">
        <label className="text-xs text-white/50">Ubicación del local (para “Cómo llegar”)</label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={captureGps}
            disabled={gpsBusy}
            className={value.latitude != null ? 'btn-emerald !py-1.5 text-xs' : 'btn-ghost !py-1.5 text-xs'}
          >
            {gpsBusy
              ? 'Ubicando…'
              : value.latitude != null
                ? '✓ Ubicación capturada'
                : '📍 Capturar mi ubicación GPS'}
          </button>
          {value.latitude != null && (
            <>
              <span className="text-[11px] text-white/40">
                {value.latitude.toFixed(5)}, {value.longitude?.toFixed(5)}
              </span>
              <button
                type="button"
                onClick={() => set({ latitude: null, longitude: null })}
                className="text-[11px] text-white/40 underline"
              >
                quitar
              </button>
            </>
          )}
        </div>
        {gpsError && <p className="mt-1 text-[11px] text-red-400">{gpsError}</p>}
        <Suspense
          fallback={
            <div className="mt-2 flex h-56 items-center justify-center rounded-xl border border-white/10 text-xs text-white/40">
              Cargando mapa…
            </div>
          }
        >
          <LocationPicker
            latitude={value.latitude}
            longitude={value.longitude}
            onChange={(lat, lng) => set({ latitude: lat, longitude: lng })}
          />
        </Suspense>
        <p className="mt-1.5 text-[11px] text-white/35">
          Arrastra el pin o toca el mapa para marcar el punto exacto de tu local.
        </p>
        <select
          className="input mt-2"
          value={value.province}
          onChange={(e) => set({ province: e.target.value })}
        >
          <option value="">Provincia / demarcación…</option>
          {PROVINCE_DEFS.filter((p) => p.slug !== 'todo-rd').map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className="input mt-2"
          placeholder="Dirección / referencia (ej. Av. 27 de Febrero #100)"
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
        />
        <input
          className="input mt-2"
          placeholder="Ciudad / sector"
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button disabled={busy || imgBusy} className="btn-gold w-full">
        {busy ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}

function normalizeInstagram(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, '').replace(/\/+$/, '')}`;
}

function normalizeWebsite(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Carga un perfil existente (DTO de la API) en el formulario para editarlo. */
export function profileToFormValue(p: {
  name?: string;
  categorySlug?: string | null;
  subcategory?: string | null;
  tagline?: string | null;
  whatsapp?: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avatarUrl?: string | null;
}): ProfileFormValue {
  return {
    name: p.name ?? '',
    categorySlug: p.categorySlug ?? '',
    subcategory: p.subcategory ?? '',
    tagline: p.tagline ?? '',
    whatsapp: p.whatsapp ?? '',
    instagramUrl: p.instagramUrl ?? '',
    websiteUrl: p.websiteUrl ?? '',
    province: p.province ?? '',
    city: p.city ?? '',
    address: p.address ?? '',
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    avatarUrl: p.avatarUrl ?? '',
  };
}

/** Convierte el formulario al payload de POST /api/profiles (omite vacíos). */
export function profileFormToPayload(v: ProfileFormValue) {
  const clean = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    name: v.name.trim(),
    categorySlug: v.categorySlug,
    subcategory: clean(v.subcategory),
    tagline: clean(v.tagline),
    whatsapp: clean(v.whatsapp),
    instagramUrl: normalizeInstagram(v.instagramUrl),
    websiteUrl: normalizeWebsite(v.websiteUrl),
    province: clean(v.province),
    city: clean(v.city),
    address: clean(v.address),
    latitude: v.latitude ?? undefined,
    longitude: v.longitude ?? undefined,
    avatarUrl: clean(v.avatarUrl),
  };
}
