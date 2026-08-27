import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { BankAccountDTO } from '@shared/types';
import CopyButton from './CopyButton';

export default function BankTransferPanel() {
  const [accounts, setAccounts] = useState<BankAccountDTO[]>([]);

  useEffect(() => {
    api<BankAccountDTO[]>('/bank-accounts')
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  if (!accounts.length) {
    return <div className="text-xs text-white/40">No hay cuentas bancarias configuradas todavía.</div>;
  }

  return (
    <div className="space-y-2">
      {accounts.map((a) => (
        <div key={a.id} className="glass p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{a.bankName}</div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{a.currency}</span>
          </div>
          <div className="mt-0.5 text-xs text-white/50">
            {a.accountHolder}
            {a.accountType ? ` · ${a.accountType}` : ''}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <code className="select-all text-sm font-bold tracking-wide">{a.accountNumber}</code>
            <CopyButton value={a.accountNumber} label="Copiar número" />
          </div>
          {a.instructions && <div className="mt-2 text-[11px] text-white/40">{a.instructions}</div>}
        </div>
      ))}
    </div>
  );
}
