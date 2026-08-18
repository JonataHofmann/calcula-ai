'use client';

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  formatBRL,
} from '@finance/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import type { BadgeProps } from '@finance/ui';
import type { TransactionRow, TransactionType } from './transactions-data';

const TABS = [
  { id: 'all', label: 'Todas Transações' },
  { id: 'income', label: 'Receitas' },
  { id: 'expense', label: 'Despesas' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const typeVariant: Record<TransactionType, BadgeProps['variant']> = {
  Compras: 'info',
  Transferência: 'default',
  Serviço: 'warning',
  Renda: 'success',
};

export interface TransactionsTableProps {
  rows: TransactionRow[];
}

export function TransactionsTable({ rows }: TransactionsTableProps) {
  const [tab, setTab] = useState<TabId>('all');

  const filtered = rows.filter((row) => {
    if (tab === 'income') {
      return !row.amount.startsWith('-');
    }
    if (tab === 'expense') {
      return row.amount.startsWith('-');
    }
    return true;
  });

  return (
    <div>
      <div className="border-border flex gap-6 border-b px-1" role="tablist">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                'focus-visible:ring-focus-ring -mb-px border-b-2 pb-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                active
                  ? 'border-primary text-primary'
                  : 'text-text-muted hover:text-text border-transparent',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <Table className="mt-2">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden md:table-cell">ID</TableHead>
            <TableHead className="hidden sm:table-cell">Tipo</TableHead>
            <TableHead className="hidden lg:table-cell">Cartão</TableHead>
            <TableHead className="hidden sm:table-cell">Data</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Recibo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty colSpan={7} message="Nenhuma transação nesta categoria" />
          ) : (
            filtered.map((row) => {
              const negative = row.amount.startsWith('-');
              const magnitude = negative ? row.amount.slice(1) : row.amount;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.description}</TableCell>
                  <TableCell className="text-text-muted hidden md:table-cell">{row.id}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={typeVariant[row.type]}>{row.type}</Badge>
                  </TableCell>
                  <TableCell className="text-text-muted hidden lg:table-cell">{row.card}</TableCell>
                  <TableCell className="text-text-muted hidden sm:table-cell">{row.date}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold',
                      negative ? 'text-danger' : 'text-success',
                    )}
                  >
                    {negative ? '-' : '+'}
                    {formatBRL(magnitude)}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="text-primary focus-visible:ring-focus-ring border-border hover:bg-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Baixar
                    </button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <nav className="mt-4 flex items-center justify-end gap-1 text-sm" aria-label="Paginação">
        <button
          type="button"
          className="text-primary focus-visible:ring-focus-ring rounded px-2 py-1 font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Anterior
        </button>
        {[1, 2, 3, 4].map((page) => (
          <button
            key={page}
            type="button"
            aria-current={page === 1 ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-focus-ring h-8 w-8 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
              page === 1
                ? 'bg-primary text-primary-foreground'
                : 'text-text-muted hover:bg-background',
            )}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className="text-primary focus-visible:ring-focus-ring rounded px-2 py-1 font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Próximo
        </button>
      </nav>
    </div>
  );
}
