'use client';

import type { CategoryTreeDto, TransactionDto } from '@finance/contracts';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TransactionsTable } from './transactions-table';

export interface OverdueGridProps {
  transactions: TransactionDto[];
  categories?: CategoryTreeDto;
  accounts?: { id: string; name: string }[];
  cards?: { id: string; name: string }[];
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  onEffectuate: (transaction: TransactionDto) => void;
  onUndoEffectuate?: (transaction: TransactionDto) => void;
}

/** Table of unpaid occurrences due before the current month. Empty when nothing is overdue. */
export function OverdueGrid({
  transactions,
  categories,
  accounts,
  cards,
  onEdit,
  onDelete,
  onEffectuate,
  onUndoEffectuate,
}: OverdueGridProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-text-muted flex items-center gap-2 p-4 text-sm">
        <CheckCircle2 className="text-success h-4 w-4" aria-hidden="true" />
        Nenhuma pendência de meses anteriores.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-warning flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Pendentes de meses anteriores
      </div>
      <TransactionsTable
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        cards={cards}
        onEdit={onEdit}
        onDelete={onDelete}
        onEffectuate={onEffectuate}
        onUndoEffectuate={onUndoEffectuate}
      />
    </div>
  );
}
