'use client';

import type {
  CreateTransactionInput,
  EffectuateInput,
  GroupScope,
  ListTransactionsQuery,
  TransactionDto,
  TransactionSort,
  UpdateTransactionInput,
} from '@finance/contracts';
import { Button, Card, Skeleton } from '@finance/ui';
import { Plus, Receipt } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { PeriodSelector } from '../../components/period-selector';
import { SummaryCards } from '../../components/summary-cards';
import { useAppDispatch, useAppSelector } from '../../hooks/use-store';
import { periodWindow } from '../../store/period-slice';
import { useAccounts } from '../accounts/use-accounts';
import { useCards } from '../cards/use-cards';
import { useCategories } from '../categories/use-categories';
import { EffectuateInvoiceModal } from './effectuate-invoice-modal';
import { EffectuateModal } from './effectuate-modal';
import { GroupScopeModal } from './group-scope-modal';
import { OverdueGrid } from './overdue-grid';
import { TransactionFormModal } from './transaction-form-modal';
import { TransactionsFilters } from './transactions-filters';
import { TransactionsTable, type InvoiceGroup } from './transactions-table';
import {
  clearFilters,
  setFilters,
  setGroupCreditCardExpenses,
  setShowOverdue,
  toggleSort,
  type TransactionFilters,
} from './transactions-ui.slice';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useEffectuateTransaction,
  useOverdue,
  useTransactions,
  useUndoEffectuateTransaction,
  useUpdateTransaction,
} from './use-transactions';

/** Maps a create payload to the editable-fields subset accepted by PATCH. */
function toUpdate(input: CreateTransactionInput): UpdateTransactionInput {
  return {
    type: input.type,
    description: input.description,
    dueDate: input.dueDate,
    amount: input.recurrence === 'installment' ? undefined : input.amount,
    notes: input.notes,
    categoryId: input.categoryId,
    accountId: input.accountId ?? null,
    creditCardId: input.creditCardId ?? null,
    endDate: input.recurrence === 'fixed' ? (input.endDate ?? null) : null,
  };
}

export function TransactionsView() {
  const dispatch = useAppDispatch();
  const period = useAppSelector((s) => s.period);
  const { filters, sort, order, showOverdue, groupCreditCardExpenses } = useAppSelector(
    (s) => s.transactionsUi,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionDto | undefined>(undefined);
  const [effectuating, setEffectuating] = useState<TransactionDto | undefined>(undefined);
  const [effectuatingInvoice, setEffectuatingInvoice] = useState<InvoiceGroup | undefined>(
    undefined,
  );
  const [scopeAction, setScopeAction] = useState<'edit' | 'delete' | null>(null);
  const [scopeTarget, setScopeTarget] = useState<TransactionDto | undefined>(undefined);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateTransactionInput | null>(null);
  const reduceMotion = useReducedMotion();

  const query: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = periodWindow(period);
    return { dueFrom, dueTo, sort, order, ...filters };
  }, [period, sort, order, filters]);

  // Period-only, filter-independent — summary cards reflect the selected period regardless of table filters.
  const periodQuery: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = periodWindow(period);
    return { dueFrom, dueTo, sort: 'dueDate', order: 'desc' };
  }, [period]);

  // Pendentes vencidos ANTES do período visualizado (não relativo a "hoje"): no mês do
  // vencimento a transação aparece só na listagem; em meses posteriores, se não efetivada,
  // cai na lista de pendentes anteriores; no mês anterior ao vencimento não aparece.
  const overdueBefore = useMemo(() => periodWindow(period).dueFrom, [period]);
  const { data: transactions, isLoading } = useTransactions(query);
  const { data: periodTransactions } = useTransactions(periodQuery);
  const { data: overdue } = useOverdue(overdueBefore, showOverdue);
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: categories } = useCategories();

  // A fatura agrupada usa só as transações do período visualizado — cada lançamento de cartão já
  // carrega o dueDate da fatura a que pertence, então a janela do mês isola a fatura correta.
  // Faturas anteriores não pagas aparecem individualmente na lista de pendentes (overdue).
  const tableTransactions = transactions ?? [];

  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const effectuate = useEffectuateTransaction();
  const undoEffectuate = useUndoEffectuateTransaction();

  const openCreate = () => {
    setEditing(undefined);
    setModalOpen(true);
  };
  const openEdit = (transaction: TransactionDto) => {
    setEditing(transaction);
    setModalOpen(true);
  };

  const submit = async (input: CreateTransactionInput) => {
    if (editing) {
      const patch = toUpdate(input);
      // A grouped occurrence needs a scope decision before the change propagates.
      if (editing.groupId) {
        setPendingUpdate(patch);
        setScopeTarget(editing);
        setScopeAction('edit');
        setModalOpen(false);
        return;
      }
      await update.mutateAsync({ id: editing.id, input: patch });
    } else {
      await create.mutateAsync(input);
    }
    setModalOpen(false);
    setEditing(undefined);
  };

  const del = async (transaction: TransactionDto) => {
    if (transaction.groupId) {
      setScopeTarget(transaction);
      setScopeAction('delete');
      return;
    }
    await remove.mutateAsync({ id: transaction.id });
  };

  const closeScope = () => {
    setScopeAction(null);
    setScopeTarget(undefined);
    setPendingUpdate(null);
    setEditing(undefined);
  };

  const confirmScope = async (scope: GroupScope) => {
    if (!scopeTarget || !scopeAction) return;
    if (scopeAction === 'delete') {
      await remove.mutateAsync({ id: scopeTarget.id, scope });
    } else if (pendingUpdate) {
      await update.mutateAsync({ id: scopeTarget.id, input: pendingUpdate, scope });
    }
    closeScope();
  };

  const confirmEffectuate = async (input: EffectuateInput) => {
    if (!effectuating) return;
    await effectuate.mutateAsync({ id: effectuating.id, input });
    setEffectuating(undefined);
  };

  const confirmEffectuateInvoice = async (date: string) => {
    if (!effectuatingInvoice) return;
    await Promise.all(
      effectuatingInvoice.transactions
        .filter((t) => t.status === 'pending')
        .map((t) => effectuate.mutateAsync({ id: t.id, input: { date, amount: t.amount } })),
    );
    setEffectuatingInvoice(undefined);
  };

  const handleUndoEffectuate = (transaction: TransactionDto) =>
    undoEffectuate.mutateAsync({ id: transaction.id });

  const handleUndoEffectuateInvoice = async (group: InvoiceGroup) => {
    await Promise.all(
      group.transactions
        .filter((t) => t.status === 'paid')
        .map((t) => undoEffectuate.mutateAsync({ id: t.id })),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Transações</h1>
          <p className="text-text-muted text-sm">Receitas e despesas do mês.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova transação
        </Button>
      </div>

      <SummaryCards transactions={periodTransactions ?? []} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="lg:hidden">
          <PeriodSelector />
        </div>
      </div>
      <Card className="flex flex-col gap-4 p-4">
        <TransactionsFilters
          filters={filters}
          onChange={(patch: TransactionFilters) => dispatch(setFilters(patch))}
          onClear={() => dispatch(clearFilters())}
          categories={categories}
          accounts={accounts ?? []}
          cards={cards ?? []}
          groupCreditCardExpenses={groupCreditCardExpenses}
          onGroupCreditCardExpensesChange={(v) => dispatch(setGroupCreditCardExpenses(v))}
          showOverdue={showOverdue}
          onShowOverdueChange={(v) => dispatch(setShowOverdue(v))}
        />
      </Card>
      <AnimatePresence initial={false}>
        {showOverdue ? (
          <motion.div
            key="overdue"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <Card className="p-4">
              <OverdueGrid
                transactions={overdue ?? []}
                categories={categories}
                accounts={accounts ?? []}
                cards={cards ?? []}
                onEdit={openEdit}
                onDelete={del}
                onEffectuate={setEffectuating}
                onUndoEffectuate={handleUndoEffectuate}
              />
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card className="flex flex-col gap-4 p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-card" />
            ))}
          </div>
        ) : tableTransactions.length > 0 ? (
          <TransactionsTable
            transactions={tableTransactions}
            categories={categories}
            accounts={accounts ?? []}
            cards={cards ?? []}
            onEdit={openEdit}
            onDelete={del}
            onEffectuate={setEffectuating}
            onEffectuateInvoice={setEffectuatingInvoice}
            onUndoEffectuate={handleUndoEffectuate}
            onUndoEffectuateInvoice={handleUndoEffectuateInvoice}
            groupCreditCardExpenses={groupCreditCardExpenses}
            sort={sort}
            order={order}
            onSort={(column: TransactionSort) => dispatch(toggleSort(column))}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="bg-info-soft text-info flex h-14 w-14 items-center justify-center rounded-full">
              <Receipt className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <p className="text-text text-sm font-semibold">Nenhuma transação neste mês</p>
              <p className="text-text-muted text-sm">
                Cadastre sua primeira transação para começar.
              </p>
            </div>
          </div>
        )}
      </Card>

      <TransactionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSubmit={submit}
        categories={categories}
        accounts={accounts ?? []}
        cards={cards ?? []}
        initial={editing}
        submitting={create.isPending || update.isPending}
      />

      <EffectuateModal
        open={effectuating !== undefined}
        onClose={() => setEffectuating(undefined)}
        onConfirm={confirmEffectuate}
        transaction={effectuating}
        submitting={effectuate.isPending}
      />

      <EffectuateInvoiceModal
        open={effectuatingInvoice !== undefined}
        onClose={() => setEffectuatingInvoice(undefined)}
        onConfirm={confirmEffectuateInvoice}
        invoice={effectuatingInvoice}
        submitting={effectuate.isPending}
      />

      <GroupScopeModal
        open={scopeAction !== null}
        action={scopeAction ?? 'edit'}
        onClose={closeScope}
        onConfirm={confirmScope}
        submitting={update.isPending || remove.isPending}
      />
    </div>
  );
}
