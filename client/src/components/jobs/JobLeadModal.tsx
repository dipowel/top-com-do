import { useState } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../hooks/useAuth';
import { authInstance } from '../../lib/firebase';
import { api } from '../../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Guarda el correo como lead, sin bloquear nunca el flujo del visitante. */
async function saveLead(email: string, jobId: string) {
  try {
    await api('/jobs/leads', { method: 'POST', body: JSON.stringify({ email, jobId }) });
  } catch {
    /* no bloquea: el visitante ya va en camino a la vacante */
  }
}

/**
 * Modal "No te pierdas los nuevos empleos" (estilo Jooble) — se muestra al aplicar sin
 * sesión. Captura un correo o deja seguir sin fricción; nunca impide ver la oferta.
 */
export default function JobLeadModal({
  jobId,
  onContinue,
}: {
  jobId: string;
  onContinue: () => void;
}) {
  const { loginGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitEmail() {
    if (!EMAIL_RE.test(email.trim())) {
      setErr('Ingresa un correo válido');
      return;
    }
    setBusy(true);
    await saveLead(email.trim(), jobId);
    setBusy(false);
    onContinue();
  }

  async function withGoogle() {
    setBusy(true);
    try {
      await loginGoogle();
      const googleEmail = authInstance?.currentUser?.email;
      if (googleEmail) await saveLead(googleEmail, jobId);
    } catch {
      /* si el popup falla o se cancela, igual se deja continuar */
    } finally {
      setBusy(false);
      onContinue();
    }
  }

  return (
    <Modal title="No te pierdas los nuevos empleos" onClose={onContinue}>
      <div className="space-y-4">
        <p className="text-sm text-white/65">
          Déjanos tu correo electrónico para recibir ofertas similares.
        </p>
        <div>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Su E-mail"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErr(null);
            }}
            className="input w-full"
          />
          {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
        </div>
        <button onClick={submitEmail} disabled={busy} className="btn-gold w-full !py-3.5 text-sm">
          {busy ? '…' : 'Continuar'}
        </button>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          o
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <button onClick={withGoogle} disabled={busy} className="btn-ghost w-full !py-3.5 text-sm">
          Continuar con Google
        </button>
        <button onClick={onContinue} className="block w-full text-center text-xs text-white/45 underline">
          Omitir por ahora
        </button>
      </div>
    </Modal>
  );
}
