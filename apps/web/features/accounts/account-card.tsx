'use client';

import { findBank, type AccountDto } from '@finance/contracts';
import {
  Card,
  COLOR_TOKEN_SOFT_BG,
  COLOR_TOKEN_TEXT,
  getIcon,
} from '@finance/ui';
import { motion, useReducedMotion } from 'motion/react';
import { Pencil, Trash2 } from 'lucide-react';

export interface AccountCardProps {
  account: AccountDto;
  onEdit: (account: AccountDto) => void;
  onDelete: (account: AccountDto) => void;
}

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const reduce = useReducedMotion();
  const Icon = getIcon(account.icon);
  const bank = findBank(account.bankId);

  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      whileHover={reduce ? undefined : { y: -2 }}
    >
      <Card className="flex items-center gap-4 p-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${COLOR_TOKEN_SOFT_BG[account.color]} ${COLOR_TOKEN_TEXT[account.color]}`}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-text truncate text-sm font-semibold">{account.name}</p>
          <span className="text-text-muted flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: bank?.color ?? '#64748B' }}
              aria-hidden="true"
            />
            {bank?.name ?? account.bankId}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(account)}
            aria-label={`Editar ${account.name}`}
            className="text-text-muted hover:bg-background hover:text-text focus-visible:ring-focus-ring rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(account)}
            aria-label={`Excluir ${account.name}`}
            className="text-text-muted hover:bg-danger-soft hover:text-danger focus-visible:ring-focus-ring rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
