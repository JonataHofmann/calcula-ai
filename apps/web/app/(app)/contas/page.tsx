import { Card, CreditCardVisual, MetricCard, TransactionList, WeeklyBarChart } from '@finance/ui';
import { CreditCard, PiggyBank, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SectionHeader } from '../../../components/section-header';
import {
  accountStats,
  debitCredit,
  invoicesSent,
  lastTransactions,
  type AccountStat,
} from '../../../features/accounts/accounts-data';
import { dashboardCards } from '../../../features/dashboard/dashboard-data';

const statMeta: Record<AccountStat['tone'], { icon: LucideIcon; soft: string; fg: string }> = {
  primary: { icon: CreditCard, soft: 'bg-info-soft', fg: 'text-info' },
  success: { icon: TrendingUp, soft: 'bg-success-soft', fg: 'text-success' },
  danger: { icon: TrendingDown, soft: 'bg-danger-soft', fg: 'text-danger' },
  warning: { icon: PiggyBank, soft: 'bg-warning-soft', fg: 'text-warning' },
};

function StatIcon({ tone }: { tone: AccountStat['tone'] }): ReactNode {
  const meta = statMeta[tone];
  const Icon = meta.icon;
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-full ${meta.soft} ${meta.fg}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export default function ContasPage() {
  const mainCard = dashboardCards[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {accountStats.map((stat) => (
          <MetricCard
            key={stat.id}
            title={stat.title}
            value={stat.value}
            icon={<StatIcon tone={stat.tone} />}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader title="Última Transação" href="/transacoes" />
          <Card className="p-5">
            <TransactionList items={lastTransactions} />
          </Card>
        </section>

        <section>
          <SectionHeader title="Meu Cartão" href="/cartoes" />
          {mainCard ? (
            <CreditCardVisual
              tone={mainCard.tone}
              balance={mainCard.balance}
              holderName={mainCard.holderName}
              maskedNumber={mainCard.maskedNumber}
              expiry={mainCard.expiry}
              className="max-w-none"
            />
          ) : null}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader title="Débito & Crédito" />
          <Card className="p-5">
            <div className="mb-2 flex justify-end gap-4 text-xs">
              <span className="text-text-muted flex items-center gap-1.5">
                <span className="bg-success h-2.5 w-2.5 rounded-full" aria-hidden="true" />
                Crédito
              </span>
              <span className="text-text-muted flex items-center gap-1.5">
                <span className="bg-danger h-2.5 w-2.5 rounded-full" aria-hidden="true" />
                Débito
              </span>
            </div>
            <WeeklyBarChart data={debitCredit} height={240} />
          </Card>
        </section>

        <section>
          <SectionHeader title="Faturas Enviadas" />
          <Card className="p-5">
            <TransactionList items={invoicesSent} />
          </Card>
        </section>
      </div>
    </div>
  );
}
