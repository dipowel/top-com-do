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
  const [presetCategory, setPresetCategory] = useState<string | undefined>(undefined);

  const openBid = (profileId?: string, category?: string) => {
    setPresetProfileId(profileId);
    setPresetCategory(category);
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
      {bidOpen && (
        <BidWizard
          key={`${presetProfileId ?? ''}-${presetCategory ?? ''}`}
          presetProfileId={presetProfileId}
          presetCategory={presetCategory}
          onClose={() => setBidOpen(false)}
        />
      )}
    </div>
  );
}
