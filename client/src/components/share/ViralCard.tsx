import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import type { RankingEntry } from '@shared/types';
import { formatDOP } from '../../lib/format';
import { shareImage, avatarFallback } from '../../lib/share';
import { profileShareUrl } from '@shared/site';
import Modal from '../common/Modal';

export default function ViralCard({ entry, onClose }: { entry: RankingEntry; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const p = entry.profile;

  async function generate() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      await shareImage(
        dataUrl,
        `top-com-do-${p.handle}.png`,
        `${p.name} es #${entry.position} en Top.com.do — ${profileShareUrl(p.id)}`,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Tarjeta viral">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-2xl border border-white/10 p-5"
        style={{ backgroundImage: 'linear-gradient(160deg,#101d38,#070b14)' }}
      >
        <div className="text-[11px] font-bold tracking-[0.25em] text-gold">TOP.COM.DO</div>
        <div className="mt-3 flex items-center gap-3">
          <img
            crossOrigin="anonymous"
            src={p.avatarUrl || avatarFallback(p.name)}
            className="h-16 w-16 rounded-xl object-cover"
            alt=""
          />
          <div>
            <div className="text-lg font-extrabold leading-tight">{p.name}</div>
            <div className="text-xs text-white/50">@{p.handle}</div>
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/40">Posición</div>
            <div className="text-3xl font-black text-gold">
              #{entry.position}
              {entry.isChampion ? ' 👑' : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Visibilidad</div>
            <div className="text-xl font-extrabold">{formatDOP(entry.totalDop)}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-white/40">
          <span>{p.provinceName ? `${p.categoryName} · ${p.provinceName}` : p.categoryName}</span>
          <span className="font-bold text-gold/70">www.top.com.do</span>
        </div>
      </div>

      <button onClick={generate} disabled={busy} className="btn-gold mt-4 w-full">
        {busy ? 'Generando…' : 'Compartir imagen'}
      </button>
    </Modal>
  );
}
