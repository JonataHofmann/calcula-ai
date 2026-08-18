import {
  BalanceLineChart,
  Card,
  CreditCardVisual,
  ExpensePieChart,
  TransactionList,
  WeeklyBarChart,
} from '@finance/ui';
import { CreditCard, DollarSign, UserRound } from 'lucide-react';
import Link from 'next/link';
import {
  balanceHistory,
  dashboardCards,
  expenseStatistics,
  recentTransactions,
  transferContacts,
  weeklyActivity,
} from '../../features/dashboard/dashboard-data';
import { QuickTransfer } from '../../features/dashboard/quick-transfer';

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-text text-lg font-semibold">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-primary focus-visible:ring-focus-ring rounded text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Ver todos
        </Link>
      ) : null}
    </div>
  );
}

const transactionIcons = [
  <CreditCard key="card" className="h-4 w-4" />,
  <DollarSign key="dollar" className="h-4 w-4" />,
  <UserRound key="user" className="h-4 w-4" />,
];

export default function OverviewPage() {
  const transactions = recentTransactions.map((tx, index) => ({
    ...tx,
    icon: transactionIcons[index],
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader title="Meus Cartões" href="/cartoes" />
          <div className="grid gap-6 sm:grid-cols-2">
            {dashboardCards.map((card) => (
              <CreditCardVisual
                key={card.id}
                tone={card.tone}
                balance={card.balance}
                holderName={card.holderName}
                maskedNumber={card.maskedNumber}
                expiry={card.expiry}
                className="max-w-none"
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Transações Recentes" href="/transacoes" />
          <Card className="p-2">
            <TransactionList items={transactions} className="px-3" />
          </Card>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader title="Atividade Semanal" />
          <Card className="p-5">
            <div className="mb-2 flex justify-end gap-4 text-xs">
              <span className="text-text-muted flex items-center gap-1.5">
                <span className="bg-success h-2.5 w-2.5 rounded-full" aria-hidden="true" />
                Depósito
              </span>
              <span className="text-text-muted flex items-center gap-1.5">
                <span className="bg-danger h-2.5 w-2.5 rounded-full" aria-hidden="true" />
                Saque
              </span>
            </div>
            <WeeklyBarChart data={weeklyActivity} height={260} />
          </Card>
        </section>

        <section>
          <SectionHeader title="Estatísticas de Despesas" />
          <Card className="p-5">
            <ExpensePieChart data={expenseStatistics} height={260} />
          </Card>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section>
          <SectionHeader title="Transferência Rápida" />
          <Card className="p-5">
            <QuickTransfer contacts={transferContacts} />
          </Card>
        </section>

        <section className="lg:col-span-2">
          <SectionHeader title="Histórico de Saldo" />
          <Card className="p-5">
            <BalanceLineChart data={balanceHistory} height={260} />
          </Card>
        </section>
      </div>
    </div>
  );
}
