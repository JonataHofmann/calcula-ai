import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { EffectuateInput } from '@finance/contracts';
import { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';
import { TransactionNotFoundError } from '../../../domain/errors';
import { nextOccurrence } from '../../../domain/recurrence';

export interface EffectuateResult {
  transaction: Transaction;
  next: Transaction | null;
}

@Injectable()
export class EffectuateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  /** pending -> paid; a fixed occurrence materializes the next pending row (FR-014/R10). */
  async execute(userId: string, id: string, input: EffectuateInput): Promise<EffectuateResult> {
    const transaction = await this.transactions.findById(id, userId);
    if (!transaction) throw new TransactionNotFoundError(id);

    transaction.effectuate({
      date: input.date ? new Date(input.date) : undefined,
      amount: input.amount,
    });

    const next = await this.materializeNext(userId, transaction);
    if (next) {
      await this.transactions.saveMany([transaction, next]);
    } else {
      await this.transactions.save(transaction);
    }
    return { transaction, next };
  }

  private async materializeNext(
    userId: string,
    current: Transaction,
  ): Promise<Transaction | null> {
    if (current.recurrence !== 'fixed' || !current.groupId) return null;
    const nextDue = nextOccurrence(current.dueDate, current.endDate);
    if (!nextDue) return null;

    const group = await this.transactions.findGroup(current.groupId, userId);
    const exists = group.some((t) => t.dueDate.getTime() === nextDue.getTime());
    if (exists) return null;

    return Transaction.create({
      id: randomUUID(),
      userId,
      description: current.description,
      dueDate: nextDue,
      amount: current.amount,
      recurrence: 'fixed',
      type: current.type,
      categoryId: current.categoryId,
      accountId: current.accountId,
      creditCardId: current.creditCardId,
      notes: current.notes,
      endDate: current.endDate,
      groupId: current.groupId,
    });
  }
}
