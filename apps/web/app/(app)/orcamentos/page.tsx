import { Card, MetricCard, ProgressBar, formatBRL } from '@finance/ui';
import { PiggyBank, TrendingDown, Wallet } from 'lucide-react';
import { SectionHeader } from '../../../components/section-header';
import { budgetCategories, budgetSummary } from '../../../features/budgets/budgets-data';

function percent(spent: string, limit: string): number {
  const s = Number(spent);
  const l = Number(limit);
  if (l <= 0) return 0;
  return Math.round((s / l) * 100);
}

export default function OrcamentosPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard
          title="Orçamento Total"
          value={budgetSummary.totalBudget}
          icon={
            <span className="bg-info-soft text-info flex h-11 w-11 items-center justify-center rounded-full">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </span>
          }
        />
        <MetricCard
          title="Gasto no Mês"
          value={budgetSummary.totalSpent}
          icon={
            <span className="bg-danger-soft text-danger flex h-11 w-11 items-center justify-center rounded-full">
              <TrendingDown className="h-5 w-5" aria-hidden="true" />
            </span>
          }
        />
        <MetricCard
          title="Disponível"
          value={budgetSummary.remaining}
          icon={
            <span className="bg-success-soft text-success flex h-11 w-11 items-center justify-center rounded-full">
              <PiggyBank className="h-5 w-5" aria-hidden="true" />
            </span>
          }
        />
      </div>

      <section>
        <SectionHeader title="Orçamento por Categoria" />
        <Card className="divide-border divide-y p-2">
          {budgetCategories.map((cat) => {
            const pct = percent(cat.spent, cat.limit);
            const over = pct > 100;
            return (
              <div key={cat.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-text text-sm font-medium">{cat.name}</p>
                  <p className="text-text-muted text-sm">
                    <span className={over ? 'text-danger font-medium' : 'text-text font-medium'}>
                      {formatBRL(cat.spent)}
                    </span>{' '}
                    / {formatBRL(cat.limit)}
                  </p>
                </div>
                <ProgressBar value={pct} tone={cat.tone} label={cat.name} />
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
