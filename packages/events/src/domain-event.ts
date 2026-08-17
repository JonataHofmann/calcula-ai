export type EventName =
  | 'TransactionCreated'
  | 'TransactionUpdated'
  | 'TransactionDeleted'
  | 'TransferCreated'
  | 'BudgetExceeded'
  | 'GoalUpdated'
  | 'RecurringTransactionGenerated'
  | 'InstallmentCreated';

export interface DomainEvent<TPayload = unknown> {
  id: string;
  name: EventName;
  occurredAt: Date;
  userId: string;
  payload: TPayload;
  correlationId?: string;
}
