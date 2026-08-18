import type { ProgressTone } from '@finance/ui';

export interface SavingsGoal {
  id: string;
  name: string;
  /** Amount saved so far, decimal string. */
  current: string;
  /** Target amount, decimal string. */
  target: string;
  deadline: string;
  tone: ProgressTone;
}

export const goalsSummary = {
  totalSaved: '18600.00',
  totalTarget: '42000.00',
  activeGoals: '4',
};

export const savingsGoals: SavingsGoal[] = [
  { id: 'emergency', name: 'Reserva de Emergência', current: '9200.00', target: '15000.00', deadline: 'Dez 2026', tone: 'primary' },
  { id: 'travel', name: 'Viagem de Férias', current: '3400.00', target: '8000.00', deadline: 'Jul 2026', tone: 'success' },
  { id: 'car', name: 'Carro Novo', current: '5000.00', target: '12000.00', deadline: 'Mar 2027', tone: 'warning' },
  { id: 'notebook', name: 'Notebook', current: '1000.00', target: '7000.00', deadline: 'Set 2026', tone: 'danger' },
];
