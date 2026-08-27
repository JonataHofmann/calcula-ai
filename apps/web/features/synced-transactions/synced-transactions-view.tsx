'use client';

import { useState } from 'react';
import type { SyncedTransactionDto, SyncStatus } from '@finance/contracts';
import {
  Badge,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeProps,
  type SelectOption,
} from '@finance/ui';
import { money } from '../../util/money';
import { day } from '../../util/date';
import { useSyncedTransactions } from './use-synced-transactions';

const STATUS_LABEL: Record<SyncStatus, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  success: 'Sucesso',
  error: 'Erro',
};

const STATUS_VARIANT: Record<SyncStatus, BadgeProps['variant']> = {
  pending: 'default',
  processing: 'warning',
  success: 'success',
  error: 'danger',
};

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'success', label: 'Sucesso' },
  { value: 'error', label: 'Erro' },
  { value: 'pending', label: 'Pendente' },
  { value: 'processing', label: 'Processando' },
];

export function SyncedTransactionsView() {
  const [filter, setFilter] = useState<'all' | SyncStatus>('all');
  const status = filter === 'all' ? undefined : filter;
  const { data: transactions, isLoading } = useSyncedTransactions(status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-text text-xl font-semibold">Transações importadas</h1>
        <Select
          aria-label="Filtrar por status"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | SyncStatus)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>ID Transactions-MS</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transactions ?? []).length === 0 ? (
                <TableEmpty colSpan={7} message="Nenhuma transação importada." />
              ) : (
                (transactions ?? []).map((t) => <SyncedTransactionRow key={t.id} transaction={t} />)
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SyncedTransactionRow({ transaction }: { transaction: SyncedTransactionDto }) {
  const signedAmount = transaction.direction === 'debit' ? `-${transaction.amount}` : transaction.amount;
  return (
    <TableRow>
      <TableCell>{day(transaction.date)}</TableCell>
      <TableCell>{transaction.description}</TableCell>
      <TableCell className="text-right font-medium">{money(signedAmount)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[transaction.syncStatus]}>
          {STATUS_LABEL[transaction.syncStatus]}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">{transaction.id}</TableCell>
      <TableCell className="font-mono text-xs">{transaction.transactionsMsId ?? '—'}</TableCell>
      <TableCell className="text-text-muted text-xs">
        {transaction.syncStatus === 'error' && transaction.lastError
          ? `${transaction.lastError} (tentativas: ${transaction.retryCount})`
          : '—'}
      </TableCell>
    </TableRow>
  );
}
