import type { CreditCardVisualProps, ExpenseSlice } from '@finance/ui';

export interface WalletCard extends CreditCardVisualProps {
  id: string;
}

export const walletCards: WalletCard[] = [
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
    tone: 'primary',
    balance: '5756.00',
    holderName: 'Eddy Cusuma',
    maskedNumber: '3778 **** **** 1234',
    expiry: '12/22',
  },
  {
    id: 'card-3',
    tone: 'light',
    balance: '5756.00',
    holderName: 'Eddy Cusuma',
    maskedNumber: '3778 **** **** 1234',
    expiry: '12/22',
  },
];

export const cardExpenseStats: ExpenseSlice[] = [
  { label: 'DBL Bank', value: 40, color: 'var(--color-chart-1)' },
  { label: 'BRR Bank', value: 25, color: 'var(--color-chart-2)' },
  { label: 'Lender', value: 20, color: 'var(--color-chart-4)' },
  { label: 'Outros', value: 15, color: 'var(--color-chart-5)' },
];

export interface CardListEntry {
  id: string;
  bank: string;
  type: string;
  maskedNumber: string;
  holderName: string;
  tone: 'primary' | 'warning' | 'success';
}

export const cardList: CardListEntry[] = [
  {
    id: 'l1',
    bank: 'DBL Bank',
    type: 'Cartão Secundário',
    maskedNumber: '**** **** 5600',
    holderName: 'William',
    tone: 'primary',
  },
  {
    id: 'l2',
    bank: 'BRR Bank',
    type: 'Cartão Secundário',
    maskedNumber: '**** **** 4300',
    holderName: 'Michel',
    tone: 'warning',
  },
  {
    id: 'l3',
    bank: 'Lender',
    type: 'Cartão Secundário',
    maskedNumber: '**** **** 7830',
    holderName: 'Edward',
    tone: 'success',
  },
];

export const cardTypeOptions = [
  { value: 'classic', label: 'Clássico' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
];
