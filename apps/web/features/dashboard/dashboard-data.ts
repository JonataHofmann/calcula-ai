import type {
  BalancePoint,
  CreditCardVisualProps,
  ExpenseSlice,
  TransactionItemProps,
  WeeklyBarDatum,
} from '@finance/ui';

export interface DashboardCard extends CreditCardVisualProps {
  id: string;
}

export const dashboardCards: DashboardCard[] = [
  {
    id: 'card-1',
    tone: 'dark',
    balance: '5756.00',
    holderName: 'Eddy Cusuma',
    maskedNumber: '3778 **** **** 1234',
    expiry: '12/22',
  },
  {
    id: 'card-2',
    tone: 'light',
    balance: '5756.00',
    holderName: 'Eddy Cusuma',
    maskedNumber: '3778 **** **** 1234',
    expiry: '12/22',
  },
];

export const recentTransactions: TransactionItemProps[] = [
  {
    description: 'Depósito do meu cartão',
    category: 'Cartão',
    date: '28 jan 2021',
    amount: '-850.00',
  },
  { description: 'Depósito Paypal', category: 'Transferência', date: '25 jan 2021', amount: '2500.00' },
  { description: 'Jemi Wilson', category: 'Transferência', date: '21 jan 2021', amount: '5400.00' },
];

export const weeklyActivity: WeeklyBarDatum[] = [
  { label: 'Sáb', deposit: 220, withdraw: 480 },
  { label: 'Dom', deposit: 120, withdraw: 340 },
  { label: 'Seg', deposit: 250, withdraw: 320 },
  { label: 'Ter', deposit: 360, withdraw: 470 },
  { label: 'Qua', deposit: 240, withdraw: 150 },
  { label: 'Qui', deposit: 240, withdraw: 390 },
  { label: 'Sex', deposit: 320, withdraw: 400 },
];

export const expenseStatistics: ExpenseSlice[] = [
  { label: 'Lazer', value: 30, color: 'var(--color-chart-1)' },
  { label: 'Contas', value: 15, color: 'var(--color-chart-2)' },
  { label: 'Investimentos', value: 20, color: 'var(--color-chart-3)' },
  { label: 'Outros', value: 35, color: 'var(--color-chart-4)' },
];

export const balanceHistory: BalancePoint[] = [
  { label: 'Jul', value: 150 },
  { label: 'Ago', value: 350 },
  { label: 'Set', value: 280 },
  { label: 'Out', value: 580 },
  { label: 'Nov', value: 250 },
  { label: 'Dez', value: 600 },
  { label: 'Jan', value: 380 },
];

export interface TransferContact {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export const transferContacts: TransferContact[] = [
  { id: 'c1', name: 'Livia Bator', role: 'CEO' },
  { id: 'c2', name: 'Randy Press', role: 'Diretor' },
  { id: 'c3', name: 'Workman', role: 'Designer' },
];
