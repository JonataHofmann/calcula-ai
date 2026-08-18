'use client';

import { Avatar, cn } from '@finance/ui';
import { Send } from 'lucide-react';
import { useState } from 'react';
import type { TransferContact } from './dashboard-data';

export interface QuickTransferProps {
  contacts: TransferContact[];
}

export function QuickTransfer({ contacts }: QuickTransferProps) {
  const [selected, setSelected] = useState(contacts[0]?.id);
  const [amount, setAmount] = useState('');
  const [sent, setSent] = useState(false);

  function handleSend() {
    if (!selected || amount.trim() === '') {
      return;
    }
    // Mock: no backend wired for transfers yet.
    setSent(true);
    setAmount('');
    window.setTimeout(() => setSent(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex gap-5">
        {contacts.map((contact) => {
          const active = contact.id === selected;
          return (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => setSelected(contact.id)}
                aria-pressed={active}
                className={cn(
                  'focus-visible:ring-focus-ring flex flex-col items-center gap-2 rounded-lg p-1 transition-transform focus-visible:ring-2 focus-visible:outline-none',
                  active && 'scale-105',
                )}
              >
                <Avatar name={contact.name} alt={contact.name} src={contact.avatar} size="lg" />
                <span className="flex flex-col items-center">
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-text' : 'text-text-muted',
                    )}
                  >
                    {contact.name}
                  </span>
                  <span className="text-text-muted text-[11px]">{contact.role}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <label htmlFor="quick-transfer-amount" className="text-text-muted shrink-0 text-sm">
          Valor
        </label>
        <div className="bg-background flex flex-1 items-center rounded-full pl-4">
          <input
            id="quick-transfer-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="525,50"
            className="text-text placeholder:text-text-muted h-11 w-full bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            className="bg-primary text-primary-foreground focus-visible:ring-focus-ring flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
          >
            {sent ? 'Enviado' : 'Enviar'}
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
