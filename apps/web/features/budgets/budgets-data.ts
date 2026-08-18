import type { ProgressTone } from '@finance/ui';

export interface BudgetCategory {
  id: string;
  name: string;
  /** Amount spent so far, decimal string. */
  spent: string;
  /** Budget limit, decimal string. */
  limit: string;
  tone: ProgressTone;
}

export const budgetSummary = {
  totalBudget: '4500.00',
  totalSpent: '3120.00',
  remaining: '1380.00',
};

export const budgetCategories: BudgetCategory[] = [
  { id: 'food', name: 'Alimentação', spent: '820.00', limit: '1000.00', tone: 'primary' },
  { id: 'transport', name: 'Transporte', spent: '340.00', limit: '400.00', tone: 'success' },
  { id: 'leisure', name: 'Lazer', spent: '560.00', limit: '600.00', tone: 'warning' },
  { id: 'bills', name: 'Contas', spent: '980.00', limit: '900.00', tone: 'danger' },
  { id: 'shopping', name: 'Compras', spent: '260.00', limit: '700.00', tone: 'primary' },
  { id: 'health', name: 'Saúde', spent: '160.00', limit: '900.00', tone: 'success' },
];
