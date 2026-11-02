import { useState } from 'react';
import { api } from '../../lib/api';

/** "Recibe vacantes nuevas por WhatsApp" — Fase 1: solo guarda la suscripción (sin envío
 *  automático todavía, lo manda un admin a mano por ahora). */
export default function AlertSignupForm({ defaultZone }: { defaultZone?: string | null }) {
  const [phone, setPhone] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/jobs/alerts', {
        method: 'POST',
        body: JSON.stringify({ phone, keywords: keywords || undefined, zone: defaultZone || undefined }),
      });
      setOk(true);
      setPhone('');
      setKeywords('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="glass p-3 text-center text-xs text-emerald-soft">
        ✓ Listo — te avisaremos por WhatsApp cuando salga una vacante así.
      </div>
    );
  }

  return (
    <div className="glass space-y-2 p-4">
      <div className="text-sm font-extrabold text-white">📲 Recibe vacantes nuevas por WhatsApp</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Tu WhatsApp (809...)"
          className="input"
        />
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Palabras clave (opcional)"
          className="input"
        />
        <button onClick={submit} disabled={busy || phone.trim().length < 8} className="btn-gold shrink-0 whitespace-nowrap !py-2.5 text-xs">
          {busy ? 'Enviando…' : 'Avísame'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
