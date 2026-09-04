import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import Footer from './Footer';
import PujarAhoraButton from './PujarAhoraButton';
import BidWizard from '../bid/BidWizard';
import { useAuth } from '../../hooks/useAuth';
import { useAuctionAccess } from '../../hooks/useAuctionAccess';
import type { ShellContext } from '../../hooks/useShell';

function RefBanner() {
  const { pendingRef, user } = useAuth();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  if (!pendingRef || user || hidden) return null;
  return (
    <div className="border-b border-gold/25 bg-gold/10 px-4 py-2 text-xs text-gold">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <span className="flex-1">
          🎁 Te invitó <b>{pendingRef}</b> — regístrate gratis y ambos ganan RD$ 100.
        </span>
        <button
          onClick={() => navigate('/login?registro=1')}
          className="shrink-0 rounded-full bg-gold px-3 py-1 font-bold text-black"
        >
          Registrarme
        </button>
        <button onClick={() => setHidden(true)} aria-label="Cerrar" className="shrink-0 px-1 text-white/50">
          ✕
        </button>
      </div>
    </div>
  );
}

export default function AppShell() {
  const canBid = useAuctionAccess();
  const [bidOpen, setBidOpen] = useState(false);
  const [presetProfileId, setPresetProfileId] = useState<string | undefined>(undefined);
  const [presetCategory, setPresetCategory] = useState<string | undefined>(undefined);
  const [presetProvince, setPresetProvince] = useState<string | undefined>(undefined);

  const openBid = (profileId?: string, category?: string, province?: string) => {
    setPresetProfileId(profileId);
    setPresetCategory(category);
    setPresetProvince(province);
    setBidOpen(true);
  };

  const ctx: ShellContext = { openBid };

  return (
    <div className="min-h-full">
      <TopBar />
      <RefBanner />
      <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-5">
        <Outlet context={ctx} />
        <Footer />
      </main>
      {canBid && <PujarAhoraButton onClick={() => openBid(undefined)} />}
      <BottomNav />
      {bidOpen && (
        <BidWizard
          key={`${presetProfileId ?? ''}-${presetCategory ?? ''}-${presetProvince ?? ''}`}
          presetProfileId={presetProfileId}
          presetCategory={presetCategory}
          presetProvince={presetProvince}
          onClose={() => setBidOpen(false)}
        />
      )}
    </div>
  );
}
