import { useOutletContext } from 'react-router-dom';

export interface ShellContext {
  openBid: (profileId?: string) => void;
}

export function useShell(): ShellContext {
  return useOutletContext<ShellContext>();
}
