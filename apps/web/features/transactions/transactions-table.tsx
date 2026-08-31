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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Landmark,
  Link2,
  Pencil,
  Receipt,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { buildCategoryPathMap } from '../../util/category';
import { day } from '../../util/date';
import { centsToMoney, money, toCents } from '../../util/money';

export interface InvoiceGroup {
  cardId: string;
  cardName: string;
  total: string;
  dueDate: string;
  status: 'pending' | 'paid';
  transactions: TransactionDto[];
}

export interface TransactionsTableProps {
  transactions: TransactionDto[];
  categories?: CategoryTreeDto;
  accounts?: { id: string; name: string }[];
  cards?: { id: string; name: string }[];
  onEdit: (transaction: TransactionDto) => void;
  onDelete: (transaction: TransactionDto) => void;
  onEffectuate?: (transaction: TransactionDto) => void;
  onEffectuateInvoice?: (group: InvoiceGroup) => void;
  onUndoEffectuate?: (transaction: TransactionDto) => void;
  onUndoEffectuateInvoice?: (group: InvoiceGroup) => void;
  groupCreditCardExpenses?: boolean;
  sort?: TransactionSort;
  order?: SortOrder;
  onSort?: (column: TransactionSort) => void;
}

/** Partitions transactions into ungrouped rows plus one InvoiceGroup per credit card, when grouping is on. */
function buildInvoiceGroups(
  transactions: TransactionDto[],
  cardMap: Map<string, string>,
  groupCreditCardExpenses: boolean,
): { ungrouped: TransactionDto[]; invoices: InvoiceGroup[] } {
  if (!groupCreditCardExpenses) return { ungrouped: transactions, invoices: [] };

  const ungrouped: TransactionDto[] = [];
  const byCard = new Map<string, TransactionDto[]>();

  for (const t of transactions) {
    if (t.creditCardId) {
      const list = byCard.get(t.creditCardId) ?? [];
      list.push(t);
      byCard.set(t.creditCardId, list);
    } else {
      ungrouped.push(t);
    }
  }

  // Receita no cartão (estorno/reembolso/pagamento) reduz a fatura → entra negativa no total.
  const invoices: InvoiceGroup[] = Array.from(byCard.entries()).map(([cardId, items]) => {
    const totalCents = items.reduce(
      (sum, t) => sum + (t.type === 'income' ? -toCents(t.amount) : toCents(t.amount)),
      0,
    );
    const dueDate = items.reduce((max, t) => (t.dueDate > max ? t.dueDate : max), items[0]!.dueDate);
    const status = items.some((t) => t.status === 'pending') ? 'pending' : 'paid';
    return {
      cardId,
      cardName: cardMap.get(cardId) ?? '—',
      total: centsToMoney(totalCents),
      dueDate,
      status,
      transactions: items,
    };
  });

  return { ungrouped, invoices };
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

const CELL = 'py-2 whitespace-nowrap';
const HEAD = 'h-9 whitespace-nowrap';

function CardDirectionIcon({ type }: { type: TransactionDto['type'] }) {
  return type === 'expense' ? (
    <span className="mr-1 inline-flex align-middle" title="Aumenta a fatura">
      <TrendingUp className="text-danger h-3 w-3" aria-hidden="true" />
    </span>
  ) : (
    <span className="mr-1 inline-flex align-middle" title="Reduz a fatura">
      <TrendingDown className="text-success h-3 w-3" aria-hidden="true" />
    </span>
  );
}

type OriginKind = 'account' | 'card' | 'none';

/** Origin cell — distinct icon + tint so a bank account reads differently from a credit card at a glance. */
function OriginTag({ label, kind }: { label: string; kind: OriginKind }) {
  if (kind === 'none') return <span className="text-text-muted text-xs">—</span>;
  const isCard = kind === 'card';
  const Icon = isCard ? CreditCard : Landmark;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isCard ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info',
      )}
      title={isCard ? 'Cartão de crédito' : 'Conta'}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function CategoryTag({ path }: { path?: CategoryNodeDto[] }) {
  if (!path || path.length === 0) return <span className="text-text-muted text-xs">—</span>;
  const leaf = path[path.length - 1]!;
  const Icon = getIcon(leaf.icon);
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        COLOR_TOKEN_SOFT_BG[leaf.color],
        COLOR_TOKEN_TEXT[leaf.color],
      )}
      title={path.map((n) => n.name).join(' > ')}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 items-center gap-0.5">
        {path.map((node, i) => (
          <span key={node.id} className="flex min-w-0 items-center gap-0.5">
            {i > 0 ? (
              <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
            ) : null}
            <span className={cn('truncate', i < path.length - 1 && 'opacity-70')}>{node.name}</span>
          </span>
        ))}
      </span>
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
  onEffectuateInvoice,
  onUndoEffectuate,
  onUndoEffectuateInvoice,
  groupCreditCardExpenses = false,
  sort,
  order,
  onSort,
}: TransactionsTableProps) {
  const categoryPathMap = buildCategoryPathMap(categories);
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  const { ungrouped, invoices } = buildInvoiceGroups(transactions, cardMap, groupCreditCardExpenses);

  const origin = (t: TransactionDto): { label: string; kind: OriginKind } => {
    if (t.creditCardId) return { label: cardMap.get(t.creditCardId) ?? '—', kind: 'card' };
    if (t.accountId) return { label: accountMap.get(t.accountId) ?? '—', kind: 'account' };
    return { label: '—', kind: 'none' };
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
        {invoices.length === 0 && ungrouped.length === 0 ? (
          <TableEmpty colSpan={COLUMNS.length + 1} message="Nenhuma transação neste mês" />
        ) : (
          <>
            {invoices.map((invoice) => (
              <TableRow key={`invoice-${invoice.cardId}`}>
                <TableCell className={cn(CELL, 'text-text font-medium')}>
                  <span className="mr-1 inline-flex align-middle" title="Fatura do cartão">
                    <Receipt className="text-text-muted h-3 w-3" aria-hidden="true" />
                  </span>
                  Fatura — {invoice.cardName}
                </TableCell>
                <TableCell className={CELL}>
                  <span className="text-text-muted text-xs">—</span>
                </TableCell>
                <TableCell className={cn(CELL, 'text-text-muted')}>{day(invoice.dueDate)}</TableCell>
                <TableCell className={cn(CELL, 'text-text')}>{money(invoice.total)}</TableCell>
                <TableCell className={CELL}>
                  <OriginTag label={invoice.cardName} kind="card" />
                </TableCell>
                <TableCell className={CELL}>
                  <Badge variant={TYPE_VARIANT.expense}>{TYPE_LABEL.expense}</Badge>
                </TableCell>
                <TableCell className={CELL}>
                  <span className="text-text-muted text-xs">—</span>
                </TableCell>
                <TableCell className={CELL}>
                  <Badge variant={invoice.status === 'paid' ? 'success' : 'default'}>
                    {invoice.status === 'paid' ? 'Paga' : 'Pendente'}
                  </Badge>
                </TableCell>
                <TableCell className={CELL}>
                  <div className="flex items-center justify-end gap-1">
                    {onEffectuateInvoice && invoice.status === 'pending' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEffectuateInvoice(invoice)}
                        aria-label={`Efetivar fatura ${invoice.cardName}`}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                    {onUndoEffectuateInvoice && invoice.status === 'paid' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onUndoEffectuateInvoice(invoice)}
                        aria-label={`Desfazer efetivação da fatura ${invoice.cardName}`}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {ungrouped.map((t) => (
            <TableRow key={t.id}>
              <TableCell className={cn(CELL, 'text-text font-medium')}>
                {t.source === 'synced' ? (
                  <span className="mr-1 inline-flex align-middle" title="Sincronizado automaticamente">
                    <Link2 className="text-text-muted h-3 w-3" aria-hidden="true" />
                  </span>
                ) : null}
                {t.description}
                {t.installmentNumber && t.installmentCount ? (
                  <span className="text-text-muted ml-1 text-xs">
                    ({t.installmentNumber}/{t.installmentCount})
                  </span>
                ) : null}
              </TableCell>
              <TableCell className={CELL}>
                <CategoryTag path={categoryPathMap.get(t.categoryId)} />
              </TableCell>
              <TableCell className={cn(CELL, 'text-text-muted')}>{day(t.dueDate)}</TableCell>
              <TableCell className={cn(CELL, t.type === 'income' ? 'text-success' : 'text-text')}>
                {t.creditCardId ? <CardDirectionIcon type={t.type} /> : null}
                {money(t.amount)}
              </TableCell>
              <TableCell className={CELL}>
                {(() => {
                  const o = origin(t);
                  return <OriginTag label={o.label} kind={o.kind} />;
                })()}
              </TableCell>
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
                  {onEffectuate && t.status === 'pending' && !t.creditCardId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEffectuate(t)}
                      aria-label={`Efetivar ${t.description}`}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                  {onUndoEffectuate && t.status === 'paid' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUndoEffectuate(t)}
                      aria-label={`Desfazer efetivação de ${t.description}`}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
            ))}
          </>
        )}
      </TableBody>
    </Table>
  );
}
