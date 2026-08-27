import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { BankAccountDTO } from '@shared/types';

type Form = Partial<BankAccountDTO> & {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  currency: 'DOP' | 'USD';
  isActive: boolean;
  sortOrder: number;
};

const empty: Form = {
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  accountType: '',
  currency: 'DOP',
  instructions: '',
  isActive: true,
  sortOrder: 0,
};

export default function BankAccountsEditor() {
  const [rows, setRows] = useState<BankAccountDTO[]>([]);
  const [form, setForm] = useState<Form>(empty);

  const load = useCallback(() => {
    api<BankAccountDTO[]>('/admin/bank-accounts', { auth: true })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (form.id) {
      await api(`/admin/bank-accounts/${form.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        auth: true,
      });
    } else {
      await api('/admin/bank-accounts', { method: 'POST', body: JSON.stringify(form), auth: true });
    }
    setForm(empty);
    load();
  }

  async function remove(id: string) {
    await api(`/admin/bank-accounts/${id}`, { method: 'DELETE', auth: true });
    load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="glass p-3 text-sm">
            <div className="flex justify-between">
              <b>{a.bankName}</b>
              <span className="text-xs text-white/40">
                {a.currency}
                {a.isActive ? '' : ' · inactiva'}
              </span>
            </div>
            <div className="text-xs text-white/50">
              {a.accountHolder} · {a.accountNumber}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setForm({ ...empty, ...a })} className="btn-ghost !py-1 text-xs">
                Editar
              </button>
              <button onClick={() => remove(a.id)} className="btn-ghost !py-1 text-xs">
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-xs text-white/40">No hay cuentas.</p>}
      </div>

      <form onSubmit={save} className="glass space-y-2 p-4">
        <h3 className="font-bold">{form.id ? 'Editar' : 'Nueva'} cuenta</h3>
        <input
          className="input"
          placeholder="Banco"
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Titular"
          value={form.accountHolder}
          onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Número de cuenta"
          value={form.accountNumber}
          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Tipo (Corriente / Ahorros)"
          value={form.accountType ?? ''}
          onChange={(e) => setForm({ ...form, accountType: e.target.value })}
        />
        <select
          className="input"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value as 'DOP' | 'USD' })}
        >
          <option value="DOP">DOP</option>
          <option value="USD">USD</option>
        </select>
        <textarea
          className="input"
          placeholder="Instrucciones"
          value={form.instructions ?? ''}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Activa
        </label>
        <input
          className="input"
          type="number"
          placeholder="Orden"
          value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
        />
        <div className="flex gap-2">
          <button className="btn-gold flex-1">Guardar</button>
          {form.id && (
            <button type="button" onClick={() => setForm(empty)} className="btn-ghost">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
