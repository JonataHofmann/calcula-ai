'use client';

import { useMemo } from 'react';
import type { ColorToken, TransactionDto } from '@finance/contracts';
import { cn, COLOR_TOKEN_SOFT_BG, COLOR_TOKEN_TEXT, MetricCard } from '@finance/ui';
import { Clock, CreditCard, Scale, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { centsToMoney, toCents } from '../util/money';

export interface SummaryCardsProps {
  transactions: TransactionDto[];
  className?: string;
}

interface Stat {
  key: string;
  title: string;
  cents: number;
  icon: LucideIcon;
  color: ColorToken;
}

/** Icon badge matching the color-token style used by BreakdownCard's row icons. */
function iconBadge(Icon: LucideIcon, color: ColorToken) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full',
        COLOR_TOKEN_SOFT_BG[color],
        COLOR_TOKEN_TEXT[color],
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Summary metrics for a period's transactions — respects whatever window the caller filtered by. */
export function SummaryCards({ transactions, className }: SummaryCardsProps) {
  const stats = useMemo<Stat[]>(() => {
    let despesas = 0;
    let receitas = 0;
    let pendentes = 0;
    let cartao = 0;
    for (const t of transactions) {
      const cents = toCents(t.amount);
      if (t.type === 'expense') {
        despesas += cents;
        if (t.status === 'pending') pendentes += cents;
        if (t.creditCardId) cartao += cents;
      } else {
        receitas += cents;
      }
    }
    const balanco = receitas - despesas;
    return [
      { key: 'despesas', title: 'Despesas', cents: despesas, icon: TrendingDown, color: 'danger' },
      { key: 'receitas', title: 'Receitas', cents: receitas, icon: TrendingUp, color: 'success' },
      { key: 'pendentes', title: 'Despesas pendentes', cents: pendentes, icon: Clock, color: 'warning' },
      { key: 'balanco', title: 'Balanço', cents: balanco, icon: Scale, color: balanco >= 0 ? 'success' : 'danger' },
      { key: 'cartao', title: 'Despesas cartão de crédito', cents: cartao, icon: CreditCard, color: 'accent' },
    ];
  }, [transactions]);

  return (
    <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5', className)}>
      {stats.map((stat) => (
        <MetricCard
          key={stat.key}
          title={stat.title}
          value={centsToMoney(stat.cents)}
          icon={iconBadge(stat.icon, stat.color)}
        />
      ))}
    </div>
  );
}
