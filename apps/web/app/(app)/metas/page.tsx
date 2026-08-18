import { Card, MetricCard, ProgressBar, formatBRL } from '@finance/ui';
import { Flag, PiggyBank, Target } from 'lucide-react';
import { SectionHeader } from '../../../components/section-header';
import { goalsSummary, savingsGoals } from '../../../features/goals/goals-data';

function percent(current: string, target: string): number {
  const c = Number(current);
  const t = Number(target);
  if (t <= 0) return 0;
  return Math.round((c / t) * 100);
}

export default function MetasPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard
          title="Total Poupado"
          value={goalsSummary.totalSaved}
          icon={
            <span className="bg-success-soft text-success flex h-11 w-11 items-center justify-center rounded-full">
              <PiggyBank className="h-5 w-5" aria-hidden="true" />
            </span>
          }
        />
        <MetricCard
          title="Meta Total"
          value={goalsSummary.totalTarget}
          icon={
            <span className="bg-info-soft text-info flex h-11 w-11 items-center justify-center rounded-full">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
          }
        />
        <MetricCard
          title="Metas Ativas"
          value={String(goalsSummary.activeGoals)}
          icon={
            <span className="bg-warning-soft text-warning flex h-11 w-11 items-center justify-center rounded-full">
              <Flag className="h-5 w-5" aria-hidden="true" />
            </span>
          }
        />
      </div>

      <section>
        <SectionHeader title="Minhas Metas" />
        <div className="grid gap-6 sm:grid-cols-2">
          {savingsGoals.map((goal) => {
            const pct = percent(goal.current, goal.target);
            return (
              <Card key={goal.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-text text-sm font-medium">{goal.name}</p>
                    <p className="text-text-muted text-xs">Prazo: {goal.deadline}</p>
                  </div>
                  <span className="text-primary text-sm font-semibold">{pct}%</span>
                </div>
                <ProgressBar value={pct} tone={goal.tone} label={goal.name} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text font-medium">{formatBRL(goal.current)}</span>
                  <span className="text-text-muted">de {formatBRL(goal.target)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
