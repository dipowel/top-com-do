import { useState } from 'react';

export default function CopyButton({ value, label }: { value: string; label?: string }) {
  const [ok, setOk] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* noop */
      }
      ta.remove();
    }
    setOk(true);
    window.setTimeout(() => setOk(false), 1500);
  }

  return (
    <button onClick={copy} className="btn-ghost shrink-0 !py-1.5 text-xs">
      {ok ? '¡Copiado!' : (label ?? 'Copiar')}
    </button>
  );
}
