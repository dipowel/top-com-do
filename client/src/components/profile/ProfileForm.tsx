import { useRef, useState, type FormEvent } from 'react';
import { useCategories } from '../../hooks/useCategories';
import { fileToLogoDataUrl } from '../../lib/image';
import { avatarFallback } from '../../lib/share';

export interface ProfileFormValue {
  name: string;
  categorySlug: string;
  tagline: string;
  whatsapp: string;
  instagramUrl: string;
  websiteUrl: string;
  city: string;
  avatarUrl: string;
}

export const emptyProfileForm: ProfileFormValue = {
  name: '',
  categorySlug: '',
  tagline: '',
  whatsapp: '',
  instagramUrl: '',
  websiteUrl: '',
  city: '',
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
  const set = (patch: Partial<ProfileFormValue>) => onChange({ ...value, ...patch });

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

      <div>
        <label className="text-xs text-white/50">Categoría</label>
        <select
          required
          className="input mt-1"
          value={value.categorySlug}
          onChange={(e) => set({ categorySlug: e.target.value })}
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

      <div>
        <label className="text-xs text-white/50">Ciudad (opcional)</label>
        <input
          className="input mt-1"
          placeholder="Santo Domingo"
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

/** Convierte el formulario al payload de POST /api/profiles (omite vacíos). */
export function profileFormToPayload(v: ProfileFormValue) {
  const clean = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    name: v.name.trim(),
    categorySlug: v.categorySlug,
    tagline: clean(v.tagline),
    whatsapp: clean(v.whatsapp),
    instagramUrl: normalizeInstagram(v.instagramUrl),
    websiteUrl: normalizeWebsite(v.websiteUrl),
    city: clean(v.city),
    avatarUrl: clean(v.avatarUrl),
  };
}
