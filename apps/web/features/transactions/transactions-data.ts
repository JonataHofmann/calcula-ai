export type TransactionType = 'Compras' | 'Transferência' | 'Serviço' | 'Renda';

export interface TransactionRow {
  id: string;
  description: string;
  type: TransactionType;
  card: string;
  date: string;
  /** Decimal string; negative = saída, positivo = entrada. */
  amount: string;
}

export const transactionRows: TransactionRow[] = [
  {
    id: '#12548796',
    description: 'Spotify Assinatura',
    type: 'Serviço',
    card: '1234 ****',
    date: '25 jan 2021',
    amount: '-150.00',
  },
  {
    id: '#12548797',
    description: 'Freepik Venda',
    type: 'Transferência',
    card: '1234 ****',
    date: '25 jan 2021',
    amount: '750.00',
  },
  {
    id: '#12548798',
    description: 'Mobile Service',
    type: 'Serviço',
    card: '1234 ****',
    date: '20 jan 2021',
    amount: '-340.00',
  },
  {
    id: '#12548799',
    description: 'Wilson Salário',
    type: 'Renda',
    card: '1234 ****',
    date: '15 jan 2021',
    amount: '5400.00',
  },
  {
    id: '#12548800',
    description: 'Emilly Store',
    type: 'Compras',
    card: '1234 ****',
    date: '14 jan 2021',
    amount: '-135.00',
  },
  {
    id: '#12548801',
    description: 'Depósito Paypal',
    type: 'Transferência',
    card: '1234 ****',
    date: '10 jan 2021',
    amount: '2500.00',
  },
];

export const myExpense = [
  { label: 'Sáb', deposit: 0, withdraw: 180 },
  { label: 'Dom', deposit: 0, withdraw: 260 },
  { label: 'Seg', deposit: 0, withdraw: 140 },
  { label: 'Ter', deposit: 0, withdraw: 320 },
  { label: 'Qua', deposit: 0, withdraw: 240 },
  { label: 'Qui', deposit: 0, withdraw: 300 },
  { label: 'Sex', deposit: 0, withdraw: 200 },
];
