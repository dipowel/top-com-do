import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import PujarAhoraButton from './PujarAhoraButton';
import BidWizard from '../bid/BidWizard';
import type { ShellContext } from '../../hooks/useShell';

export default function AppShell() {
  const [bidOpen, setBidOpen] = useState(false);
  const [presetProfileId, setPresetProfileId] = useState<string | undefined>(undefined);

  const openBid = (profileId?: string) => {
    setPresetProfileId(profileId);
    setBidOpen(true);
  };

  const ctx: ShellContext = { openBid };

  return (
    <div className="min-h-full">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-40 pt-5">
        <Outlet context={ctx} />
      </main>
      <PujarAhoraButton onClick={() => openBid(undefined)} />
      <BottomNav />
      {bidOpen && <BidWizard presetProfileId={presetProfileId} onClose={() => setBidOpen(false)} />}
    </div>
  );
}
