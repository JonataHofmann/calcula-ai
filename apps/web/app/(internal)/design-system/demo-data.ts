import type { TransactionItemProps } from '@finance/ui';

export const metricSamples = [
  { title: 'Saldo atual', value: '2850.75', delta: '12.5', deltaLabel: 'vs. mês anterior' },
  { title: 'Receitas', value: '1500.50', delta: '4.1', deltaLabel: 'vs. mês anterior' },
  { title: 'Despesas', value: '350.60', delta: '-3.2', deltaLabel: 'vs. mês anterior' },
  { title: 'Patrimônio total', value: '1234567.89', delta: '8.9', deltaLabel: 'no ano' },
] as const;

export const transactionSamples: TransactionItemProps[] = [
  { description: 'Tesco Market', category: 'Compras', date: '13 dez 2020', amount: '-75.67' },
  {
    description: 'ElectroMen Market',
    category: 'Compras',
    date: '14 dez 2020',
    amount: '-250.00',
  },
  { description: 'Fiorgio Restaurant', category: 'Alimentação', date: '07 dez 2020', amount: '-19.50' },
  { description: 'Salário', category: 'Renda', date: '05 dez 2020', amount: '3500.00' },
  {
    description: 'Transferência recebida de John Mathew Kayne com descrição muito longa para testar truncamento',
    category: 'Transferência',
    date: '06 dez 2020',
    amount: '350.00',
  },
];

export const tableSamples = [
  { receiver: 'Tesco Market', type: 'Compras', date: '13 dez 2020', amount: '-75.67' },
  { receiver: 'Fiorgio Restaurant', type: 'Alimentação', date: '07 dez 2020', amount: '-19.50' },
  { receiver: 'Ann Marlin', type: 'Compras', date: '31 nov 2020', amount: '-430.00' },
] as const;

export const selectOptions = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'investment', label: 'Investimentos', disabled: true },
];
