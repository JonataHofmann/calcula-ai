'use client';

import type { SortOrder, TransactionDto, TransactionSort } from '@finance/contracts';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@finance/ui';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Pencil, Trash2 } from 'lucide-react';

export interface TransactionsTableProps {
  transactions: TransactionDto[];
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  onEffectuate?: (transaction: TransactionDto) => void;
  sort?: TransactionSort;
  order?: SortOrder;
  onSort?: (column: TransactionSort) => void;
}

const SORTABLE: { column: TransactionSort; label: string }[] = [
  { column: 'description', label: 'Descrição' },
  { column: 'dueDate', label: 'Vencimento' },
  { column: 'amount', label: 'Valor' },
  { column: 'type', label: 'Tipo' },
  { column: 'recurrence', label: 'Recorrência' },
  { column: 'status', label: 'Status' },
];

const TYPE_LABEL: Record<TransactionDto['type'], string> = {
  expense: 'Despesa',
  income: 'Receita',
};

const RECURRENCE_LABEL: Record<TransactionDto['recurrence'], string> = {
  single: 'Avulsa',
  fixed: 'Fixa',
  installment: 'Parcelada',
};

/** Formats a decimal-string amount as pt-BR currency. */
function money(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formats an ISO instant as a pt-BR date (day/month/year). */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  onEffectuate,
  sort,
  order,
  onSort,
}: TransactionsTableProps) {
  const sortIcon = (column: TransactionSort) => {
    if (sort !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />;
    return order === 'desc' ? (
      <ArrowDown className="h-3 w-3" aria-hidden="true" />
    ) : (
      <ArrowUp className="h-3 w-3" aria-hidden="true" />
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE.map(({ column, label }) => (
            <TableHead key={column}>
              {onSort ? (
                <button
                  type="button"
                  className="text-text-muted hover:text-text inline-flex items-center gap-1"
                  onClick={() => onSort(column)}
                  aria-label={`Ordenar por ${label}`}
                >
                  {label}
                  {sortIcon(column)}
                </button>
              ) : (
                label
              )}
            </TableHead>
          ))}
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableEmpty colSpan={7} message="Nenhuma transação neste mês" />
        ) : (
          transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-text font-medium">
                {t.description}
                {t.installmentNumber && t.installmentCount ? (
                  <span className="text-text-muted ml-1 text-xs">
                    ({t.installmentNumber}/{t.installmentCount})
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-text-muted">{day(t.dueDate)}</TableCell>
              <TableCell className={t.type === 'income' ? 'text-success' : 'text-text'}>
                {money(t.amount)}
              </TableCell>
              <TableCell>{TYPE_LABEL[t.type]}</TableCell>
              <TableCell>{RECURRENCE_LABEL[t.recurrence]}</TableCell>
              <TableCell>
                <Badge variant={t.status === 'paid' ? 'success' : 'default'}>
                  {t.status === 'paid' ? 'Paga' : 'Pendente'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {onEffectuate && t.status === 'pending' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEffectuate(t)}
                      aria-label={`Efetivar ${t.description}`}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(t)}
                    aria-label={`Editar ${t.description}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(t)}
                    aria-label={`Excluir ${t.description}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
