'use client';

import { createElement, useMemo } from 'react';
import type { ColorToken, ListTransactionsQuery } from '@finance/contracts';
import { BalanceBarChart, Card, ChartContainer, formatBRL, TransactionList, cn, getIcon } from '@finance/ui';
import { Receipt } from 'lucide-react';
import { PeriodSelector } from '../../components/period-selector';
import { SummaryCards } from '../../components/summary-cards';
import { useAppSelector } from '../../hooks/use-store';
import { periodLabel, periodWindow } from '../../store/period-slice';
import { centsToMoney, toCents } from '../../util/money';
import { MONTH_LABELS, yearWindow } from '../../util/date';
import { flattenCategories, type CategoryMeta } from '../../util/category';
import { useAccounts } from '../accounts/use-accounts';
import { useCards } from '../cards/use-cards';
import { useCategories } from '../categories/use-categories';
import { useTransactions } from '../transactions/use-transactions';
import { BreakdownCard, type BreakdownRow } from './breakdown-card';

/** Palette cycled for entities that carry no color token of their own (credit cards). */
const CARD_PALETTE: ColorToken[] = ['primary', 'accent', 'indigo', 'teal', 'pink', 'sky', 'orange'];

export function DashboardView() {
  const period = useAppSelector((s) => s.period);

  const query: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = periodWindow(period);
    return { dueFrom, dueTo, sort: 'dueDate', order: 'desc' };
  }, [period]);

  const yearQuery: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = yearWindow(period.year);
    return { dueFrom, dueTo, sort: 'dueDate', order: 'asc' };
  }, [period.year]);

  const { data: transactions, isLoading } = useTransactions(query);
  const { data: yearTransactions } = useTransactions(yearQuery);
  const { data: accounts } = useAccounts();
  const { data: cards } = useCards();
  const { data: categories } = useCategories();

  const categoryMeta = useMemo(() => {
    const map = new Map<string, CategoryMeta>();
    if (categories) {
      flattenCategories(categories.expense, map);
      flattenCategories(categories.income, map);
    }
    return map;
  }, [categories]);

  const expenses = useMemo(
    () => (transactions ?? []).filter((t) => t.type === 'expense'),
    [transactions],
  );

  const byCategory = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, number>();
    for (const t of expenses) {
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + toCents(t.amount));
    }
    return [...totals.entries()].map(([id, cents]) => {
      const meta = categoryMeta.get(id);
      return {
        id,
        label: meta?.name ?? 'Sem categoria',
        cents,
        color: meta?.color ?? 'slate',
        icon: createElement(getIcon(meta?.icon ?? 'tag'), { className: 'h-4 w-4' }),
      };
    });
  }, [expenses, categoryMeta]);

  const byAccount = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, number>();
    for (const t of expenses) {
      if (!t.accountId) continue;
      totals.set(t.accountId, (totals.get(t.accountId) ?? 0) + toCents(t.amount));
    }
    return [...totals.entries()].map(([id, cents]) => {
      const account = accounts?.find((a) => a.id === id);
      return {
        id,
        label: account?.name ?? 'Conta',
        cents,
        color: account?.color ?? 'slate',
        icon: createElement(getIcon(account?.icon ?? 'landmark'), { className: 'h-4 w-4' }),
      };
    });
  }, [expenses, accounts]);

  const byCard = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, number>();
    for (const t of expenses) {
      if (!t.creditCardId) continue;
      totals.set(t.creditCardId, (totals.get(t.creditCardId) ?? 0) + toCents(t.amount));
    }
    return [...totals.entries()].map(([id, cents], index) => {
      const card = cards?.find((c) => c.id === id);
      return {
        id,
        label: card ? `${card.name} ·· ${card.lastDigits}` : 'Cartão',
        cents,
        color: CARD_PALETTE[index % CARD_PALETTE.length] ?? 'primary',
      };
    });
  }, [expenses, cards]);

  const yearlyBalance = useMemo(() => {
    const buckets = MONTH_LABELS.map((label) => ({ label, income: 0, expense: 0, balance: 0 }));
    for (const t of yearTransactions ?? []) {
      const bucket = buckets[new Date(t.dueDate).getUTCMonth()];
      if (!bucket) continue;
      const value = toCents(t.amount) / 100;
      if (t.type === 'income') bucket.income += value;
      else bucket.expense += value;
    }
    for (const bucket of buckets) bucket.balance = bucket.income - bucket.expense;
    return buckets;
  }, [yearTransactions]);

  const yearBalanceCents = useMemo(
    () =>
      (yearTransactions ?? []).reduce(
        (sum, t) => sum + (t.type === 'income' ? toCents(t.amount) : -toCents(t.amount)),
        0,
      ),
    [yearTransactions],
  );

  const latest = useMemo(
    () =>
      (transactions ?? []).slice(0, 8).map((t) => ({
        description: t.description,
        date: new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        amount: `${t.type === 'expense' ? '-' : ''}${t.amount}`,
        category: categoryMeta.get(t.categoryId)?.name,
        icon: createElement(getIcon(categoryMeta.get(t.categoryId)?.icon ?? 'tag'), {
          className: 'h-4 w-4',
        }),
      })),
    [transactions, categoryMeta],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Dashboard</h1>
          <p className="text-text-muted text-sm capitalize">{periodLabel(period)}</p>
        </div>
        <div className="lg:hidden">
          <PeriodSelector />
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <SummaryCards transactions={transactions ?? []} />

          <ChartContainer
            title={`Balanço do ano de ${period.year}`}
            actions={
              <span
                className={cn(
                  'text-sm font-semibold',
                  yearBalanceCents >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                Balanço do ano: {formatBRL(centsToMoney(yearBalanceCents))}
              </span>
            }
          >
            <BalanceBarChart
              data={yearlyBalance}
              height={280}
              valueFormatter={(value) => formatBRL(value.toFixed(2)).replace(',00', '')}
            />
          </ChartContainer>

          <div className="grid gap-6 lg:grid-cols-3">
            <BreakdownCard title="Despesas por categoria" rows={byCategory} />
            <BreakdownCard title="Despesas por conta" rows={byAccount} />
            <BreakdownCard title="Despesas por cartão de crédito" rows={byCard} />
          </div>

          <Card className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="bg-info-soft text-info flex h-8 w-8 items-center justify-center rounded-full">
                <Receipt className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-text text-sm font-semibold">Últimos lançamentos</h3>
            </div>
            <TransactionList items={latest} emptyMessage="Nenhum lançamento neste período" />
          </Card>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className={cn('flex flex-col gap-4 p-5')}>
            <div className="bg-border/50 h-4 w-32 animate-pulse rounded" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="bg-border/40 h-8 w-full animate-pulse rounded" />
            ))}
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="bg-border/50 mb-4 h-4 w-40 animate-pulse rounded" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-border/40 mb-3 h-10 w-full animate-pulse rounded" />
        ))}
      </Card>
    </div>
  );
}
