import { useOutletContext } from 'react-router-dom';

export interface ShellContext {
  openBid: (profileId?: string, category?: string, province?: string) => void;
}

export function useShell(): ShellContext {
  return useOutletContext<ShellContext>();
}
