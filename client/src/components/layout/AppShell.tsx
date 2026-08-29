import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import Footer from './Footer';
import PujarAhoraButton from './PujarAhoraButton';
import BidWizard from '../bid/BidWizard';
import type { ShellContext } from '../../hooks/useShell';

export default function AppShell() {
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
      <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-5">
        <Outlet context={ctx} />
        <Footer />
      </main>
      <PujarAhoraButton onClick={() => openBid(undefined)} />
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
