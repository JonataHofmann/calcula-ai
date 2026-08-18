import { Inject, Injectable } from '@nestjs/common';
import type { OverdueQuery } from '@finance/contracts';
import type { Transaction } from '../../../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../../../domain/transaction.repository';

@Injectable()
export class ListOverdueUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
  ) {}

  /** Pending occurrences due before the current month start (user timezone -> `before`). */
  async execute(userId: string, query: OverdueQuery): Promise<Transaction[]> {
    return this.transactions.findOverdue(userId, new Date(query.before));
  }
}
