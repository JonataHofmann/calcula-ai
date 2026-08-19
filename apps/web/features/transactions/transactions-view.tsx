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
import { useAppDispatch, useAppSelector } from '../../hooks/use-store';
import { periodWindow } from '../../store/period-slice';
import { useAccounts } from '../accounts/use-accounts';
import { useCards } from '../cards/use-cards';
import { useCategories } from '../categories/use-categories';
import { EffectuateModal } from './effectuate-modal';
import { GroupScopeModal } from './group-scope-modal';
import { startOfMonth } from './month-window';
import { OverdueGrid } from './overdue-grid';
import { TransactionFormModal } from './transaction-form-modal';
import { TransactionsFilters } from './transactions-filters';
import { TransactionsTable } from './transactions-table';
import {
  clearFilters,
  setFilters,
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
  const { filters, sort, order, showOverdue } = useAppSelector((s) => s.transactionsUi);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionDto | undefined>(undefined);
  const [effectuating, setEffectuating] = useState<TransactionDto | undefined>(undefined);
  const [scopeAction, setScopeAction] = useState<'edit' | 'delete' | null>(null);
  const [scopeTarget, setScopeTarget] = useState<TransactionDto | undefined>(undefined);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateTransactionInput | null>(null);
  const reference = useMemo(() => new Date(), []);
  const reduceMotion = useReducedMotion();

  const query: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = periodWindow(period);
    return { dueFrom, dueTo, sort, order, ...filters };
  }, [period, sort, order, filters]);

  const overdueBefore = useMemo(() => startOfMonth(reference), [reference]);
  const { data: transactions, isLoading } = useTransactions(query);
  const { data: overdue } = useOverdue(overdueBefore, showOverdue);
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: categories } = useCategories();

  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const effectuate = useEffectuateTransaction();

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="lg:hidden">
          <PeriodSelector />
        </div>
        <Button
          variant={showOverdue ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => dispatch(setShowOverdue(!showOverdue))}
          className="sm:ml-auto"
        >
          Pendentes de meses anteriores
        </Button>
      </div>

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
              <OverdueGrid transactions={overdue ?? []} onEffectuate={setEffectuating} />
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card className="flex flex-col gap-4 p-4">
        <TransactionsFilters
          filters={filters}
          onChange={(patch: TransactionFilters) => dispatch(setFilters(patch))}
          onClear={() => dispatch(clearFilters())}
          categories={categories}
          accounts={accounts ?? []}
          cards={cards ?? []}
        />

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-card" />
            ))}
          </div>
        ) : transactions && transactions.length > 0 ? (
          <TransactionsTable
            transactions={transactions}
            onEdit={openEdit}
            onDelete={del}
            onEffectuate={setEffectuating}
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
              <p className="text-text-muted text-sm">Cadastre sua primeira transação para começar.</p>
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
