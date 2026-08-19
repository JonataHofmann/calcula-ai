'use client';

import type { CategoryNodeDto, CategoryTreeDto, SortOrder, TransactionDto, TransactionSort } from '@finance/contracts';
import {
  Badge,
  Button,
  cn,
  COLOR_TOKEN_SOFT_BG,
  COLOR_TOKEN_TEXT,
  getIcon,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeProps,
} from '@finance/ui';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { buildCategoryMap } from '../../util/category';
import { day } from '../../util/date';
import { money } from '../../util/money';

export interface TransactionsTableProps {
  transactions: TransactionDto[];
  categories?: CategoryTreeDto;
  accounts?: { id: string; name: string }[];
  cards?: { id: string; name: string }[];
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  onEffectuate?: (transaction: TransactionDto) => void;
  sort?: TransactionSort;
  order?: SortOrder;
  onSort?: (column: TransactionSort) => void;
}

interface Column {
  key: string;
  label: string;
  sort?: TransactionSort;
}

const COLUMNS: Column[] = [
  { key: 'description', label: 'Descrição', sort: 'description' },
  { key: 'category', label: 'Categoria' },
  { key: 'dueDate', label: 'Vencimento', sort: 'dueDate' },
  { key: 'amount', label: 'Valor', sort: 'amount' },
  { key: 'origin', label: 'Conta/Cartão' },
  { key: 'type', label: 'Tipo', sort: 'type' },
  { key: 'recurrence', label: 'Recorrência', sort: 'recurrence' },
  { key: 'status', label: 'Status', sort: 'status' },
];

const TYPE_LABEL: Record<TransactionDto['type'], string> = {
  expense: 'Despesa',
  income: 'Receita',
};

const TYPE_VARIANT: Record<TransactionDto['type'], BadgeProps['variant']> = {
  expense: 'danger',
  income: 'success',
};

const RECURRENCE_LABEL: Record<TransactionDto['recurrence'], string> = {
  single: 'Avulsa',
  fixed: 'Fixa',
  installment: 'Parcelada',
};

const RECURRENCE_VARIANT: Record<TransactionDto['recurrence'], BadgeProps['variant']> = {
  single: 'default',
  fixed: 'info',
  installment: 'warning',
};

const CELL = 'py-2';
const HEAD = 'h-9';

function CategoryTag({ category }: { category?: CategoryNodeDto }) {
  if (!category) return <span className="text-text-muted text-xs">—</span>;
  const Icon = getIcon(category.icon);
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        COLOR_TOKEN_SOFT_BG[category.color],
        COLOR_TOKEN_TEXT[category.color],
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

export function TransactionsTable({
  transactions,
  categories,
  accounts = [],
  cards = [],
  onEdit,
  onDelete,
  onEffectuate,
  sort,
  order,
  onSort,
}: TransactionsTableProps) {
  const categoryMap = buildCategoryMap(categories);
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  const origin = (t: TransactionDto): string => {
    if (t.creditCardId) return cardMap.get(t.creditCardId) ?? '—';
    if (t.accountId) return accountMap.get(t.accountId) ?? '—';
    return '—';
  };

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
          {COLUMNS.map(({ key, label, sort: column }) => (
            <TableHead key={key} className={HEAD}>
              {column && onSort ? (
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
          <TableHead className={cn(HEAD, 'text-right')}>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableEmpty colSpan={COLUMNS.length + 1} message="Nenhuma transação neste mês" />
        ) : (
          transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className={cn(CELL, 'text-text font-medium')}>
                {t.description}
                {t.installmentNumber && t.installmentCount ? (
                  <span className="text-text-muted ml-1 text-xs">
                    ({t.installmentNumber}/{t.installmentCount})
                  </span>
                ) : null}
              </TableCell>
              <TableCell className={CELL}>
                <CategoryTag category={categoryMap.get(t.categoryId)} />
              </TableCell>
              <TableCell className={cn(CELL, 'text-text-muted')}>{day(t.dueDate)}</TableCell>
              <TableCell className={cn(CELL, t.type === 'income' ? 'text-success' : 'text-text')}>
                {money(t.amount)}
              </TableCell>
              <TableCell className={cn(CELL, 'text-text-muted')}>{origin(t)}</TableCell>
              <TableCell className={CELL}>
                <Badge variant={TYPE_VARIANT[t.type]}>{TYPE_LABEL[t.type]}</Badge>
              </TableCell>
              <TableCell className={CELL}>
                <Badge variant={RECURRENCE_VARIANT[t.recurrence]}>
                  {RECURRENCE_LABEL[t.recurrence]}
                </Badge>
              </TableCell>
              <TableCell className={CELL}>
                <Badge variant={t.status === 'paid' ? 'success' : 'default'}>
                  {t.status === 'paid' ? 'Paga' : 'Pendente'}
                </Badge>
              </TableCell>
              <TableCell className={CELL}>
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
