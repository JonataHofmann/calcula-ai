import { Card, CreditCardVisual, WeeklyBarChart } from '@finance/ui';
import { SectionHeader } from '../../../components/section-header';
import { dashboardCards } from '../../../features/dashboard/dashboard-data';
import { myExpense, transactionRows } from '../../../features/transactions/transactions-data';
import { TransactionsTable } from '../../../features/transactions/transactions-table';

export default function TransacoesPage() {
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
          <SectionHeader title="Minhas Despesas" />
          <Card className="p-5">
            <WeeklyBarChart
              data={myExpense}
              height={220}
              depositColor="var(--color-primary)"
              withdrawColor="var(--color-primary)"
            />
          </Card>
        </section>
      </div>

      <section>
        <SectionHeader title="Transações Recentes" />
        <Card className="p-5">
          <TransactionsTable rows={transactionRows} />
        </Card>
      </section>
    </div>
  );
}
