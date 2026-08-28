import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import { fileToReceiptDataUrl } from '../../lib/image';

export default function ReceiptUpload({ bidId, onDone }: { bidId: string; onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToReceiptDataUrl(file);
      await api('/uploads/receipt', {
        method: 'POST',
        body: JSON.stringify({ bidId, dataUrl, filename: file.name }),
        auth: true,
      });
      setOk(true);
      onDone?.();
    } catch (e) {
      setError((e as Error).message || 'No se pudo subir el comprobante');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={ok ? 'btn-emerald w-full' : 'btn-ghost w-full'}
      >
        {busy ? 'Subiendo…' : ok ? '✓ Comprobante enviado' : '📎 Subir comprobante (foto o PDF)'}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] text-white/40">
        Se comprime en tu teléfono antes de enviarse. Compatible con Safari y Chrome móvil.
      </p>
    </div>
  );
}
