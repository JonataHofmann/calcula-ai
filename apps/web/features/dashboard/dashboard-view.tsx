'use client';

import { createElement, useMemo, useState } from 'react';
import type { ColorToken, ListTransactionsQuery } from '@finance/contracts';
import { BalanceBarChart, Card, ChartContainer, formatBRL, Modal, TransactionList, cn, getIcon } from '@finance/ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Receipt } from 'lucide-react';
import { MonthRangePicker } from '../../components/month-range-picker';
import { PeriodSelector } from '../../components/period-selector';
import { SummaryCards } from '../../components/summary-cards';
import { useAppSelector } from '../../hooks/use-store';
import { periodLabel, periodWindow } from '../../store/period-slice';
import { centsToMoney, toCents } from '../../util/money';
import { MONTH_LABELS, monthBuckets, monthRangeWindow } from '../../util/date';
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
  const reduceMotion = useReducedMotion();

  const query: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = periodWindow(period);
    return { dueFrom, dueTo, sort: 'dueDate', order: 'desc' };
  }, [period]);

  // Intervalo do balanço anual (independente do período global). Default: jan→dez do ano atual.
  const [range, setRange] = useState(() => ({
    from: `${period.year}-01`,
    to: `${period.year}-12`,
  }));

  const yearQuery: ListTransactionsQuery = useMemo(() => {
    const { dueFrom, dueTo } = monthRangeWindow(range.from, range.to);
    return { dueFrom, dueTo, sort: 'dueDate', order: 'asc' };
  }, [range.from, range.to]);

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

  // Categoria selecionada para drill nas subcategorias (null = visão por categoria-raiz).
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null);
  // Categoria (sub ou folha) cujas transações do período são exibidas num modal (null = fechado).
  const [txCategoryId, setTxCategoryId] = useState<string | null>(null);

  // qualquer categoria (raiz ou sub) → id da raiz; e conjunto de raízes que têm subcategorias.
  const { rootOfCategory, drillableRoots } = useMemo(() => {
    const rootOf = new Map<string, string>();
    const drillable = new Set<string>();
    for (const root of categories?.expense ?? []) {
      rootOf.set(root.id, root.id);
      if (root.children.length > 0) drillable.add(root.id);
      for (const child of root.children) rootOf.set(child.id, root.id);
    }
    return { rootOfCategory: rootOf, drillableRoots: drillable };
  }, [categories]);

  const rowFromCategory = (id: string, cents: number, fallback: string): BreakdownRow => {
    const meta = categoryMeta.get(id);
    return {
      id,
      label: meta?.name ?? fallback,
      cents,
      color: meta?.color ?? 'slate',
      icon: createElement(getIcon(meta?.icon ?? 'tag'), { className: 'h-4 w-4' }),
    };
  };

  // Visão de topo: despesas agregadas por categoria-raiz.
  const byCategory = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, number>();
    for (const t of expenses) {
      const rootId = rootOfCategory.get(t.categoryId) ?? t.categoryId;
      totals.set(rootId, (totals.get(rootId) ?? 0) + toCents(t.amount));
    }
    return [...totals.entries()].map(([id, cents]) => rowFromCategory(id, cents, 'Sem categoria'));
  }, [expenses, categoryMeta, rootOfCategory]);

  // Drill: dentro da raiz selecionada, quebra por subcategoria (categoryId direto na raiz = "Geral").
  const bySubcategory = useMemo<BreakdownRow[]>(() => {
    if (!drillCategoryId) return [];
    const totals = new Map<string, number>();
    for (const t of expenses) {
      if ((rootOfCategory.get(t.categoryId) ?? t.categoryId) !== drillCategoryId) continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + toCents(t.amount));
    }
    return [...totals.entries()].map(([id, cents]) => {
      if (id === drillCategoryId) return { ...rowFromCategory(id, cents, 'Geral'), label: 'Geral' };
      return rowFromCategory(id, cents, 'Subcategoria');
    });
  }, [expenses, categoryMeta, rootOfCategory, drillCategoryId]);

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
        icon: createElement(getIcon('credit-card'), { className: 'h-4 w-4' }),
      };
    });
  }, [expenses, cards]);

  // Conta + cartão numa única visão de "origem" da despesa.
  const byOrigin = useMemo<BreakdownRow[]>(() => [...byAccount, ...byCard], [byAccount, byCard]);

  const yearlyBalance = useMemo(() => {
    const span = monthBuckets(range.from, range.to);
    const multiYear = new Set(span.map((b) => b.year)).size > 1;
    const buckets = span.map((b) => ({
      label: multiYear
        ? `${MONTH_LABELS[b.month]}/${String(b.year).slice(2)}`
        : MONTH_LABELS[b.month]!,
      income: 0,
      expense: 0,
      balance: 0,
      changePct: null as number | null,
    }));
    // Índice ano*12+mês → posição no array, pra alocar cada transação no bucket certo.
    const index = new Map(span.map((b, i) => [b.year * 12 + b.month, i]));
    for (const t of yearTransactions ?? []) {
      const d = new Date(t.dueDate);
      const bucket = buckets[index.get(d.getUTCFullYear() * 12 + d.getUTCMonth()) ?? -1];
      if (!bucket) continue;
      const value = toCents(t.amount) / 100;
      if (t.type === 'income') bucket.income += value;
      else bucket.expense += value;
    }
    for (const bucket of buckets) bucket.balance = bucket.income - bucket.expense;
    // Variação % do balanço vs. mês anterior (só quando o mês anterior teve movimento).
    for (let i = 1; i < buckets.length; i++) {
      const prev = buckets[i - 1]!.balance;
      const curr = buckets[i]!.balance;
      if (prev !== 0) buckets[i]!.changePct = ((curr - prev) / Math.abs(prev)) * 100;
    }
    return buckets;
  }, [yearTransactions, range.from, range.to]);

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

  // Transações do período lançadas exatamente na categoria selecionada (drill → clique).
  const categoryTx = useMemo(() => {
    if (!txCategoryId) return [];
    return (transactions ?? [])
      .filter((t) => t.categoryId === txCategoryId)
      .map((t) => ({
        description: t.description,
        date: new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        amount: `${t.type === 'expense' ? '-' : ''}${t.amount}`,
        category: categoryMeta.get(t.categoryId)?.name,
        icon: createElement(getIcon(categoryMeta.get(t.categoryId)?.icon ?? 'tag'), {
          className: 'h-4 w-4',
        }),
      }));
  }, [txCategoryId, transactions, categoryMeta]);

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
            title="Balanço do período"
            actions={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <MonthRangePicker
                  from={range.from}
                  to={range.to}
                  onChange={setRange}
                />
                <span
                  className={cn(
                    'text-sm font-semibold',
                    yearBalanceCents >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {formatBRL(centsToMoney(yearBalanceCents))}
                </span>
              </div>
            }
          >
            <BalanceBarChart
              data={yearlyBalance}
              height={280}
              positiveBalanceColor="var(--color-info)"
              negativeBalanceColor="var(--color-warning)"
              valueFormatter={(value) => formatBRL(value.toFixed(2)).replace(',00', '')}
            />
          </ChartContainer>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={drillCategoryId ?? '__root__'}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: drillCategoryId ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: drillCategoryId ? -24 : 24 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
              >
                {drillCategoryId ? (
                  <BreakdownCard
                    title={categoryMeta.get(drillCategoryId)?.name ?? 'Categoria'}
                    rows={bySubcategory}
                    onBack={() => setDrillCategoryId(null)}
                    // Clicar numa subcategoria mostra as transações lançadas nela.
                    onRowClick={(id) => setTxCategoryId(id)}
                    hint="Toque numa fatia para ver os lançamentos"
                  />
                ) : (
                  <BreakdownCard
                    title="Despesas por categoria"
                    rows={byCategory}
                    onRowClick={(id) => {
                      // Raiz com subcategorias → drill; folha → transações direto.
                      if (drillableRoots.has(id)) setDrillCategoryId(id);
                      else setTxCategoryId(id);
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <BreakdownCard title="Despesas por conta e cartão de crédito" rows={byOrigin} />
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

      <Modal
        open={txCategoryId !== null}
        onClose={() => setTxCategoryId(null)}
        title={txCategoryId ? (categoryMeta.get(txCategoryId)?.name ?? 'Categoria') : 'Categoria'}
        description="Lançamentos deste período nesta categoria."
      >
        <TransactionList items={categoryTx} emptyMessage="Nenhum lançamento nesta categoria." />
      </Modal>
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
