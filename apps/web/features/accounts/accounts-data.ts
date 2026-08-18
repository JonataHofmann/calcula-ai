import type { TransactionItemProps, WeeklyBarDatum } from '@finance/ui';

export interface AccountStat {
  id: string;
  title: string;
  value: string;
  tone: 'primary' | 'warning' | 'danger' | 'success';
}

export const accountStats: AccountStat[] = [
  { id: 'balance', title: 'Meu Saldo', value: '12750.00', tone: 'primary' },
  { id: 'income', title: 'Receitas', value: '5600.00', tone: 'success' },
  { id: 'expense', title: 'Despesas', value: '3460.00', tone: 'danger' },
  { id: 'saving', title: 'Total Poupado', value: '7920.00', tone: 'warning' },
];

export const lastTransactions: TransactionItemProps[] = [
  { description: 'Depósito do meu cartão', category: 'Cartão', date: '28 jan 2021', amount: '-850.00' },
  { description: 'Depósito Paypal', category: 'Transferência', date: '25 jan 2021', amount: '2500.00' },
  { description: 'Jemi Wilson', category: 'Transferência', date: '21 jan 2021', amount: '5400.00' },
];

export const invoicesSent: TransactionItemProps[] = [
  { description: 'Apple Store', category: 'Fatura', date: '5h atrás', amount: '450.00' },
  { description: 'Michael', category: 'Fatura', date: '2 dias atrás', amount: '160.00' },
  { description: 'Playstation', category: 'Fatura', date: '5 dias atrás', amount: '1085.00' },
  { description: 'William', category: 'Fatura', date: '10 dias atrás', amount: '90.00' },
];

export const debitCredit: WeeklyBarDatum[] = [
  { label: 'Sáb', deposit: 380, withdraw: 240 },
  { label: 'Dom', deposit: 300, withdraw: 400 },
  { label: 'Seg', deposit: 340, withdraw: 260 },
  { label: 'Ter', deposit: 480, withdraw: 300 },
  { label: 'Qua', deposit: 260, withdraw: 340 },
  { label: 'Qui', deposit: 300, withdraw: 220 },
  { label: 'Sex', deposit: 420, withdraw: 360 },
];
